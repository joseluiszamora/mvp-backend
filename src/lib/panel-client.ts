import type { DemoState, Preferences } from "./demo";

export const panelFreshnessMs = 15_000;

// Una preferencia no debe cambiar las referencias de listas que no se modificaron.
export function mergePanelState(previous: DemoState, incoming: Partial<DemoState>): DemoState {
  const next = { ...previous };
  for (const key of Object.keys(incoming) as (keyof DemoState)[]) {
    const value = incoming[key];
    if (JSON.stringify(previous[key]) !== JSON.stringify(value)) Object.assign(next, { [key]: value });
  }
  return next;
}

export class ReadCache {
  private entries = new Map<string, { expires: number; promise: Promise<unknown> }>();

  clear() { this.entries.clear(); }

  invalidate(matches: (key: string) => boolean) {
    for (const key of this.entries.keys()) if (matches(key)) this.entries.delete(key);
  }

  get<T>(key: string, read: () => Promise<T>, now = Date.now(), ttl = panelFreshnessMs): Promise<T> {
    for (const [entryKey, entry] of this.entries) if (entry.expires <= now) this.entries.delete(entryKey);
    const cached = this.entries.get(key);
    if (cached && cached.expires > now) return cached.promise as Promise<T>;
    const entry = { expires: now + ttl, promise: Promise.resolve().then(read) };
    if (this.entries.size >= 128) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, entry);
    entry.promise.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
    return entry.promise;
  }
}

type PendingPreference = { changes: Partial<Preferences>; resolve: (value: Preferences) => void; reject: (error: unknown) => void };

// Serializa y fusiona clics recibidos mientras hay un guardado en vuelo.
export function createPreferenceQueue(save: (organizationId: string, changes: Partial<Preferences>) => Promise<Preferences>) {
  const pending = new Map<string, PendingPreference[]>();
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending.size) {
        const [organizationId, batch] = pending.entries().next().value!;
        pending.delete(organizationId);
        const changes = Object.assign({}, ...batch.map((item) => item.changes)) as Partial<Preferences>;
        try { const result = await save(organizationId, changes); batch.forEach((item) => item.resolve(result)); }
        catch (error) { batch.forEach((item) => item.reject(error)); }
      }
    } finally { running = false; }
  }
  return (organizationId: string, changes: Partial<Preferences>) => new Promise<Preferences>((resolve, reject) => {
    const batch = pending.get(organizationId) ?? [];
    batch.push({ changes, resolve, reject });
    pending.set(organizationId, batch);
    // Los cambios del mismo turno se agrupan antes de abrir una petición.
    queueMicrotask(() => { void drain(); });
  });
}
