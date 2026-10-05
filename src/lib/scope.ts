import { permissionFor, type DemoState } from "./demo";

export type ScopeSession = { userId: string; organizationId: string };

export function scopedState(state: DemoState, session: ScopeSession): DemoState {
  const scoped = structuredClone(state);
  scoped.accountId = session.userId;
  scoped.organizationId = session.organizationId;
  scoped.scenario = "normal";
  scoped.latency = 0;
  const accessible = state.memberships.filter((item) => item.userId === session.userId && item.status === "Activo").map((item) => item.organizationId);
  scoped.organizations = state.organizations.filter((item) => accessible.includes(item.id));
  scoped.memberships = state.memberships.filter((item) => item.userId === session.userId || item.organizationId === session.organizationId && permissionFor(scoped, "users.read"));
  const userIds = new Set([session.userId, ...scoped.memberships.filter((item) => item.organizationId === session.organizationId).map((item) => item.userId)]);
  scoped.users = state.users.filter((item) => userIds.has(item.id));
  scoped.roles = state.roles.filter((item) => item.organizationId === session.organizationId);
  scoped.files = permissionFor(scoped, "files.read") ? state.files.filter((item) => item.organizationId === session.organizationId) : [];
  scoped.notifications = state.notifications.filter((item) => item.organizationId === session.organizationId && item.userId === session.userId);
  scoped.audit = permissionFor(scoped, "audit.read") ? state.audit.filter((item) => item.organizationId === session.organizationId) : [];
  scoped.preferences = Object.fromEntries(Object.entries(state.preferences).filter(([key]) => key === `${session.userId}:${session.organizationId}`));
  return scoped;
}
