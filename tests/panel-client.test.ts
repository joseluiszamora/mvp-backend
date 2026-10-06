import assert from "node:assert/strict";
import test from "node:test";
import { defaultPreferences, seedDemo } from "../src/lib/demo";
import { createPreferenceQueue, mergePanelState, panelFreshnessMs, ReadCache } from "../src/lib/panel-client";

test("guardar el tema conserva las listas y evita recargas de sus consumidores", () => {
  const previous = seedDemo();
  const incoming = structuredClone(previous);
  incoming.preferences["andes-u1:andes"] = { ...defaultPreferences(), theme: "dark" };
  const next = mergePanelState(previous, incoming);
  for (const key of ["users", "memberships", "roles", "files", "notifications", "audit", "organizations"] as const) assert.equal(next[key], previous[key]);
  assert.equal(next.preferences["andes-u1:andes"].theme, "dark");
});

test("las lecturas concurrentes se deduplican, caducan y se invalidan al cambiar de sesión", async () => {
  const cache = new ReadCache();
  let calls = 0;
  const read = async () => ++calls;
  const first = cache.get("cuenta:empresa:usuarios", read, 100);
  assert.equal(cache.get("cuenta:empresa:usuarios", read, 101), first);
  assert.deepEqual(await Promise.all([first, cache.get("cuenta:empresa:usuarios", read, 102)]), [1, 1]);
  assert.equal(await cache.get("otra-cuenta:empresa:usuarios", read, 103), 2);
  assert.equal(await cache.get("cuenta:empresa:usuarios", read, 100 + panelFreshnessMs), 3);
  cache.clear();
  assert.equal(await cache.get("cuenta:empresa:usuarios", read, 101 + panelFreshnessMs), 4);
});

test("una lectura fallida puede reintentarse sin esperar la caducidad", async () => {
  const cache = new ReadCache();
  await assert.rejects(cache.get("usuarios", async () => { throw new Error("Sin conexión"); }));
  assert.equal(await cache.get("usuarios", async () => "recuperado"), "recuperado");
});

test("invalidar una lectura en vuelo no permite que vuelva a llenar la caché", async () => {
  const cache = new ReadCache();
  let complete!: (value: string) => void;
  const old = cache.get("usuarios", () => new Promise<string>((resolve) => { complete = resolve; }));
  await Promise.resolve();
  cache.clear();
  const fresh = cache.get("usuarios", async () => "nuevo");
  complete("anterior");
  assert.equal(await old, "anterior");
  assert.equal(await fresh, "nuevo");
  assert.equal(await cache.get("usuarios", async () => "inesperado"), "nuevo");
});

test("los cambios rápidos de preferencias se fusionan y el último tema gana", async () => {
  const saved: unknown[] = [];
  const queue = createPreferenceQueue(async (organizationId, changes) => {
    saved.push({ organizationId, changes });
    return { ...defaultPreferences(), ...changes };
  });
  const first = queue("andes", { theme: "dark" });
  const second = queue("andes", { theme: "light", accentDark: "violet" });
  const results = await Promise.all([first, second]);
  assert.deepEqual(saved, [{ organizationId: "andes", changes: { theme: "light", accentDark: "violet" } }]);
  assert.equal(results[0].theme, "light");
  assert.equal(results[1].accentDark, "violet");
});

test("los cambios recibidos durante un guardado se serializan y no se pierden", async () => {
  let release!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  const writes: string[] = [];
  const queue = createPreferenceQueue(async (_organizationId, changes) => {
    writes.push(changes.theme!);
    if (writes.length === 1) { started(); await new Promise<void>((resolve) => { release = resolve; }); }
    return { ...defaultPreferences(), ...changes };
  });
  const first = queue("andes", { theme: "dark" });
  await startedPromise;
  const second = queue("andes", { theme: "system" });
  const third = queue("andes", { theme: "light" });
  assert.deepEqual(writes, ["dark"]);
  release();
  await Promise.all([first, second, third]);
  assert.deepEqual(writes, ["dark", "light"]);
});

test("un guardado fallido no impide guardar después ni mezcla empresas", async () => {
  let count = 0;
  const queue = createPreferenceQueue(async (organizationId, changes) => {
    if (++count === 1) throw new Error("Sin conexión");
    assert.equal(organizationId, "altiplano");
    assert.deepEqual(changes, { theme: "light" });
    return { ...defaultPreferences(), ...changes };
  });
  await assert.rejects(queue("andes", { theme: "dark" }));
  assert.equal((await queue("altiplano", { theme: "light" })).theme, "light");
});
