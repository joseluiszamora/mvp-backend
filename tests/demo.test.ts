import assert from "node:assert/strict";
import test from "node:test";
import { permissionFor, seedDemo, type DemoState } from "../src/lib/demo";
import { createMockService } from "../src/lib/demo-service";
import { scopedState } from "../src/lib/scope";

function setup() {
  let state = seedDemo();
  state.accountId = "andes-u1";
  state.latency = 0;
  const service = createMockService(() => state, (mutate) => { const draft = structuredClone(state); mutate(draft); state = draft; });
  return { service, get state() { return state; }, setState(value: DemoState) { state = value; } };
}

test("separación de empresas y permisos del rol", async () => {
  const demo = setup();
  assert.equal(permissionFor(demo.state, "users.create"), true);
  assert.equal((await demo.service.listUsers({ organizationId: "andes", page: 1, pageSize: 5 })).total, 12);
  await assert.rejects(demo.service.listUsers({ organizationId: "altiplano" }), { code: "DENIED" });
  const editor = { ...demo.state, accountId: "andes-u4" };
  demo.setState(editor);
  assert.equal(permissionFor(editor, "users.create"), false);
  await assert.rejects(demo.service.saveUser({ organizationId: "andes", name: "Nuevo", email: "nuevo@example.com", roleId: "andes-consulta" }), { code: "DENIED" });
});

test("correo duplicado y último administrador", async () => {
  const demo = setup();
  await assert.rejects(demo.service.saveUser({ organizationId: "andes", name: "Duplicado", email: "admin.andes@example.com", roleId: "andes-consulta" }), { code: "VALIDATION" });
  await assert.rejects(demo.service.changeUserStatus("andes", ["andes-u1"]), { code: "VALIDATION" });
  assert.equal(demo.state.memberships.find((item) => item.userId === "andes-u1" && item.organizationId === "andes")?.status, "Activo");
});

test("crear usuario actualiza datos y auditoría de la empresa", async () => {
  const demo = setup();
  const created = await demo.service.saveUser({ organizationId: "andes", name: "Nueva Persona", email: "nueva@example.com", roleId: "andes-consulta" });
  assert.equal((await demo.service.listUsers({ organizationId: "andes", search: "nueva" })).total, 1);
  assert.equal(demo.state.audit[0].entityId, created.id);
  assert.equal(demo.state.audit[0].organizationId, "andes");
  assert.equal(demo.state.memberships.filter((item) => item.organizationId === "altiplano").length, 13);
});

test("una persona conserva membresías independientes en dos empresas", async () => {
  const demo = setup();
  const altiplano = { ...demo.state, organizationId: "altiplano" };
  demo.setState(altiplano);
  assert.equal(permissionFor(altiplano, "users.create"), true);
  assert.equal((await demo.service.listUsers({ organizationId: "altiplano" })).total, 13);
  assert.equal(altiplano.memberships.filter((item) => item.userId === "andes-u1").length, 2);
});

test("un editor con permisos no puede conceder un permiso que no posee", async () => {
  const demo = setup();
  const draft = structuredClone(demo.state);
  draft.roles.find((item) => item.id === "andes-editor")!.permissions.push("roles.manage");
  demo.setState({ ...draft, accountId: "andes-u4" });
  await assert.rejects(demo.service.setRolePermission("andes", "andes-consulta", "users.create", true), { code: "DENIED" });
  await assert.rejects(demo.service.setRolePermission("andes", "andes-admin", "users.read", false), { code: "DENIED" });
});

test("archivos y preferencias se restringen a empresa y cuenta activas", async () => {
  const demo = setup();
  await assert.rejects(demo.service.listFiles("altiplano"), { code: "DENIED" });
  const file = await demo.service.addFile("andes", { name: "Prueba.txt", mimeType: "text/plain", size: 12 });
  assert.equal((await demo.service.listFiles("andes", { search: "Prueba" })).total, 1);
  await demo.service.updatePreferences("andes", { density: "Compacta" });
  assert.equal(demo.state.preferences["andes-u1:andes"].density, "Compacta");
  assert.equal(demo.state.preferences["andes-u1:altiplano"], undefined);
  await demo.service.deleteFile("andes", file.id);
  assert.equal((await demo.service.listFiles("andes", { search: "Prueba" })).total, 0);
});

test("escenarios vacío y error son deterministas", async () => {
  const demo = setup();
  demo.setState({ ...demo.state, scenario: "vacío" });
  assert.equal((await demo.service.listUsers({ organizationId: "andes" })).total, 0);
  demo.setState({ ...demo.state, scenario: "error" });
  await assert.rejects(demo.service.listUsers({ organizationId: "andes" }), { code: "SERVICE" });
});

test("la auditoría no guarda imágenes locales ni secretos", async () => {
  const demo = setup();
  await demo.service.updateProfile({ avatar: "data:image/png;base64,AAA" });
  assert.equal((demo.state.audit[0].after as { avatar: string }).avatar, "[imagen local]");
});

test("la respuesta del servidor excluye datos de empresas y permisos ajenos", () => {
  const source = seedDemo();
  const viewer = scopedState(source, { userId: "andes-u2", organizationId: "andes" });
  assert.equal(viewer.organizations.length, 1);
  assert.ok(viewer.users.every((item) => item.id.startsWith("andes-")));
  assert.ok(viewer.files.every((item) => item.organizationId === "andes"));
  assert.equal(viewer.audit.length, 0);
  assert.ok(viewer.notifications.every((item) => item.userId === "andes-u2"));
  const shared = scopedState(source, { userId: "andes-u1", organizationId: "altiplano" });
  assert.equal(shared.organizations.length, 2);
  assert.ok(shared.files.every((item) => item.organizationId === "altiplano"));
});
