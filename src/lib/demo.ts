import { users as initialUsers } from "./users";

export type Permission = "users.read" | "users.create" | "users.update" | "users.deactivate" | "users.export" | "roles.manage" | "settings.manage" | "files.read" | "files.manage" | "audit.read" | "organization.manage";
export type RoleName = string;
export type ModuleId = "dashboard" | "users" | "roles" | "organization" | "settings" | "files" | "notifications" | "audit" | "profile";
export type Entity = { id: string; organizationId: string };
export type Organization = { id: string; name: string; slug: string; color: string; currency: string; timezone: string; logoLight?: string; logoDark?: string; logoCompact?: string; favicon?: string; enabledModules: ModuleId[]; branches: { id: string; name: string; address: string; status: "Activa" | "Inactiva" }[] };
export type User = { id: string; name: string; email: string; avatar?: string | null; createdAt: string };
export type Membership = Entity & { userId: string; roleId: string; status: "Activo" | "Inactivo" };
export type MemberUser = User & Pick<Membership, "organizationId" | "roleId" | "status">;
export type Role = { id: string; organizationId: string; name: RoleName; permissions: Permission[]; protected: boolean };
export type FileRecord = Entity & { name: string; mimeType: string; size: number; ownerId: string; createdAt: string; sampleAssetPath?: string };
export type Notification = Entity & { userId: string; title: string; message: string; category: "actividad" | "sistema"; readAt: string | null; createdAt: string; targetRoute?: string };
export type AuditEvent = Entity & { actorId: string; module: string; action: string; entityId: string; before: unknown; after: unknown; createdAt: string };
export type Preferences = { theme: "light" | "dark" | "system"; accentLight: string; accentDark: string; locale: string; density: "Cómoda" | "Compacta"; favorites: string[]; tableColumns: string[]; notificationChannels?: { panel: boolean; correo: boolean }; notificationCategories?: { actividad: boolean; sistema: boolean } };
export function defaultPreferences(): Preferences { return { theme: "system", accentLight: "blue", accentDark: "blue", locale: "es-BO", density: "Cómoda", favorites: [], tableColumns: ["role", "status", "date"], notificationChannels: { panel: true, correo: false }, notificationCategories: { actividad: true, sistema: true } }; }
export type DemoState = { version: 2; organizations: Organization[]; users: User[]; memberships: Membership[]; roles: Role[]; files: FileRecord[]; notifications: Notification[]; audit: AuditEvent[]; preferences: Record<string, Preferences>; accountId: string | null; organizationId: string; scenario: "normal" | "vacío" | "error"; latency: number };
export type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ListQuery = { search?: string; page?: number; pageSize?: number; sort?: "asc" | "desc" };
export type DemoErrorCode = "VALIDATION" | "DENIED" | "NOT_FOUND" | "SERVICE";
export class DemoError extends Error { constructor(public code: DemoErrorCode, message: string) { super(message); } }

export const modules: { id: ModuleId; href: string; label: string; permission?: Permission; essential?: boolean }[] = [
  { id: "dashboard", href: "/", label: "Inicio", essential: true },
  { id: "users", href: "/usuarios", label: "Usuarios", permission: "users.read" },
  { id: "roles", href: "/roles", label: "Roles", permission: "roles.manage", essential: true },
  { id: "organization", href: "/empresa", label: "Empresa", essential: true },
  { id: "settings", href: "/configuracion", label: "Configuración", essential: true },
  { id: "files", href: "/archivos", label: "Archivos", permission: "files.read" },
  { id: "notifications", href: "/notificaciones", label: "Notificaciones", essential: true },
  { id: "audit", href: "/auditoria", label: "Auditoría", permission: "audit.read" },
  { id: "profile", href: "/perfil", label: "Perfil", essential: true },
];

const adminPermissions: Permission[] = ["users.read", "users.create", "users.update", "users.deactivate", "users.export", "roles.manage", "settings.manage", "files.read", "files.manage", "audit.read", "organization.manage"];
const editorPermissions: Permission[] = ["users.read", "users.update", "files.read", "files.manage"];
const viewerPermissions: Permission[] = ["users.read", "files.read"];
const moduleIds = modules.map((item) => item.id);
const organizations: Organization[] = [
  { id: "andes", name: "Andes Demo", slug: "andes-demo", color: "blue", currency: "BOB", timezone: "America/La_Paz", enabledModules: [...moduleIds], branches: [{ id: "a1", name: "Central", address: "La Paz", status: "Activa" }, { id: "a2", name: "Sur", address: "El Alto", status: "Activa" }] },
  { id: "altiplano", name: "Altiplano Demo", slug: "altiplano-demo", color: "violet", currency: "BOB", timezone: "America/La_Paz", enabledModules: [...moduleIds], branches: [{ id: "b1", name: "Central", address: "Oruro", status: "Activa" }, { id: "b2", name: "Norte", address: "Cochabamba", status: "Activa" }] },
];
const roles: Role[] = organizations.flatMap((organization) => ([
  { id: `${organization.id}-admin`, organizationId: organization.id, name: "Administrador" as const, permissions: [...adminPermissions], protected: true },
  { id: `${organization.id}-editor`, organizationId: organization.id, name: "Editor" as const, permissions: [...editorPermissions], protected: false },
  { id: `${organization.id}-consulta`, organizationId: organization.id, name: "Consulta" as const, permissions: [...viewerPermissions], protected: false },
]));
const seededMembers = organizations.flatMap((organization, companyIndex) => Array.from({ length: 12 }, (_, index) => {
  const source = initialUsers[index % initialUsers.length];
  const role = index === 0 ? "admin" : index % 3 === 0 ? "editor" : "consulta";
  return { id: `${organization.id}-u${index + 1}`, organizationId: organization.id, name: companyIndex === 0 ? source.name : `${source.name} ${index + 1}`, email: index === 0 && companyIndex === 0 ? "admin.andes@example.com" : index === 0 ? "admin.altiplano@example.com" : `${organization.id}.u${index + 1}@example.com`, roleId: `${organization.id}-${role}`, status: index % 5 === 4 ? "Inactivo" : "Activo", createdAt: `2026-09-${String(28 - index).padStart(2, "0")}T12:00:00Z` };
}));
const users: User[] = seededMembers.map(({ id, name, email, createdAt }) => ({ id, name, email, createdAt }));
const memberships: Membership[] = [
  ...seededMembers.map(({ id, organizationId, roleId, status }) => ({ id: `member-${id}`, organizationId, userId: id, roleId, status: status as Membership["status"] })),
  { id: "member-andes-u1-altiplano", organizationId: "altiplano", userId: "andes-u1", roleId: "altiplano-admin", status: "Activo" },
];
const files: FileRecord[] = Array.from({ length: 15 }, (_, index) => ({ id: `f${index + 1}`, organizationId: index < 8 ? "andes" : "altiplano", name: `Documento ${index + 1}.txt`, mimeType: "text/plain", size: 1024 * (index + 1), ownerId: index < 8 ? `andes-u${index + 1}` : `altiplano-u${index - 7}`, createdAt: `2026-09-${String(20 - index).padStart(2, "0")}T12:00:00Z`, sampleAssetPath: "/muestra.txt" }));
const notifications: Notification[] = Array.from({ length: 12 }, (_, index) => ({ id: `n${index + 1}`, organizationId: index < 6 ? "andes" : "altiplano", userId: index < 6 ? "andes-u1" : "altiplano-u1", title: `Aviso ${index + 1}`, message: "Actividad de demostración disponible para revisar.", category: index % 2 ? "actividad" : "sistema", readAt: index % 3 === 0 ? "2026-09-25T12:00:00Z" : null, createdAt: `2026-09-${String(25 - index).padStart(2, "0")}T12:00:00Z`, targetRoute: "/usuarios" }));
const audit: AuditEvent[] = Array.from({ length: 40 }, (_, index) => ({ id: `e${index + 1}`, organizationId: index < 20 ? "andes" : "altiplano", actorId: index < 20 ? "andes-u1" : "altiplano-u1", module: index % 2 ? "usuarios" : "archivos", action: "consulta demo", entityId: index % 2 ? (index < 20 ? "andes-u1" : "altiplano-u1") : (index < 20 ? "f1" : "f9"), before: null, after: null, createdAt: `2026-09-${String(28 - index % 20).padStart(2, "0")}T12:00:00Z` }));

export function seedDemo(): DemoState { return { version: 2, organizations: structuredClone(organizations), users: structuredClone(users), memberships: structuredClone(memberships), roles: structuredClone(roles), files: structuredClone(files), notifications: structuredClone(notifications), audit: structuredClone(audit), preferences: {}, accountId: null, organizationId: "andes", scenario: "normal", latency: 150 }; }
export const storageKey = "panel-admin-demo-v1";
export function memberFor(state: DemoState, userId: string | null, organizationId = state.organizationId): Membership | undefined { return state.memberships.find((item) => item.userId === userId && item.organizationId === organizationId); }
export function membersForOrganization(state: DemoState, organizationId = state.organizationId): MemberUser[] { return state.memberships.filter((item) => item.organizationId === organizationId).flatMap((membership) => { const user = state.users.find((item) => item.id === membership.userId); return user ? [{ ...user, organizationId, roleId: membership.roleId, status: membership.status }] : []; }); }
export function permissionFor(state: DemoState, code: Permission): boolean { const membership = memberFor(state, state.accountId); return !!membership && membership.status === "Activo" && !!state.roles.find((role) => role.id === membership.roleId && role.organizationId === state.organizationId)?.permissions.includes(code); }
export function visibleModule(state: DemoState, id: ModuleId): boolean { const entry = modules.find((item) => item.id === id); const organization = state.organizations.find((item) => item.id === state.organizationId); return !!entry && !!organization?.enabledModules.includes(id) && (!entry.permission || permissionFor(state, entry.permission)); }
export function paginate<T>(items: T[], query: ListQuery): PageResult<T> { const page = Math.max(1, query.page ?? 1); const pageSize = Math.max(1, query.pageSize ?? 10); return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }; }
function safeAuditValue(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("data:") ? "[imagen local]" : value;
  if (Array.isArray(value)) return value.map(safeAuditValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|token|secret/i.test(key) ? "[omitido]" : safeAuditValue(item)]));
  return value;
}
export function auditChange(state: DemoState, module: string, action: string, entityId: string, before: unknown, after: unknown): void { state.audit.unshift({ id: crypto.randomUUID(), organizationId: state.organizationId, actorId: state.accountId ?? "demo", module, action, entityId, before: safeAuditValue(before), after: safeAuditValue(after), createdAt: new Date().toISOString() }); }
