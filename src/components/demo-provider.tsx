"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { accentStorageKey, isAccentColor } from "@/lib/appearance";
import { DemoError, permissionFor, seedDemo, type DemoState, type Permission } from "@/lib/demo";
import type { MockService } from "@/lib/demo-service";

type ContextValue = {
  state: DemoState; ready: boolean; notice: string; dirty: boolean; setDirty: (value: boolean) => void;
  service: MockService; requirePermission: (permission: Permission) => void; refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>;
  switchOrganization: (id: string) => Promise<void>; changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  provisionUser: (userId: string, password: string) => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
function emptyState(): DemoState { const state = seedDemo(); return { ...state, users: [], memberships: [], roles: [], files: [], notifications: [], audit: [], preferences: {}, accountId: null }; }
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new DemoError(response.status === 403 ? "DENIED" : "SERVICE", data.error ?? "No se pudo completar la operación.");
  return data;
}
function applyAccents(state: DemoState) {
  if (!state.accountId) return;
  const preference = state.preferences[`${state.accountId}:${state.organizationId}`];
  for (const mode of ["light", "dark"] as const) {
    const saved = preference?.[mode === "light" ? "accentLight" : "accentDark"];
    let color = isAccentColor(saved ?? null) ? saved : state.organizations.find((item) => item.id === state.organizationId)?.color ?? "blue";
    if (!isAccentColor(color)) color = "blue";
    document.documentElement.setAttribute(`data-accent-${mode}`, color);
    try { localStorage.setItem(accentStorageKey(mode), color); } catch {}
  }
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(emptyState);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const refresh = useCallback(async () => {
    try { const result = await request<{ state: DemoState }>("/api/panel"); setState(result.state); setNotice(""); }
    catch (error) { setState(emptyState()); if (error instanceof DemoError && error.message !== "Sesión requerida.") setNotice(error.message); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!ready) return; applyAccents(state); const org = state.organizations.find((item) => item.id === state.organizationId); let icon = document.querySelector<HTMLLinkElement>('link[data-panel-favicon="true"]'); if (org?.favicon && state.accountId) { if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; icon.dataset.panelFavicon = "true"; document.head.appendChild(icon); } icon.href = org.favicon; } else icon?.remove(); }, [state, ready]);
  const service = useMemo<MockService>(() => {
    const reads = new Set(["listUsers", "listRoles", "listFiles", "listNotifications", "listAudit"]);
    async function call<T>(method: keyof MockService, ...args: unknown[]): Promise<T> {
      const response = await request<{ result: T; state: DemoState }>("/api/panel", { method, args });
      if (!reads.has(method)) setState(response.state);
      return response.result;
    }
    return {
      listUsers: (query) => call("listUsers", query), saveUser: (input) => call("saveUser", input), changeUserStatus: (organizationId, ids) => call("changeUserStatus", organizationId, ids),
      listRoles: (organizationId) => call("listRoles", organizationId), createRole: (organizationId, name) => call("createRole", organizationId, name), setRolePermission: (organizationId, roleId, code, enabled) => call("setRolePermission", organizationId, roleId, code, enabled),
      listFiles: (organizationId, query) => call("listFiles", organizationId, query), addFile: (organizationId, file) => call("addFile", organizationId, file), renameFile: (organizationId, id, name) => call("renameFile", organizationId, id, name), deleteFile: (organizationId, id) => call("deleteFile", organizationId, id),
      listNotifications: (organizationId) => call("listNotifications", organizationId), markNotifications: (organizationId, ids) => call("markNotifications", organizationId, ids), listAudit: (organizationId, query) => call("listAudit", organizationId, query),
      updateOrganization: (organizationId, changes) => call("updateOrganization", organizationId, changes), addBranch: (organizationId, name) => call("addBranch", organizationId, name), updateBranch: (organizationId, id, changes) => call("updateBranch", organizationId, id, changes),
      updatePreferences: (organizationId, changes) => call("updatePreferences", organizationId, changes), updateProfile: (changes) => call("updateProfile", changes),
    };
  }, []);
  const requirePermission = useCallback((permission: Permission) => { if (!permissionFor(state, permission)) throw new DemoError("DENIED", "No tienes permiso para esta acción."); }, [state]);
  async function signIn(email: string, password: string) { const response = await request<{ state: DemoState }>("/api/auth/login", { email, password }); setState(response.state); setNotice(""); setDirty(false); }
  async function signOut() { try { await request("/api/auth/logout", {}); } finally { setState(emptyState()); setDirty(false); } }
  async function switchOrganization(id: string) { const response = await request<{ state: DemoState }>("/api/auth/organization", { organizationId: id }); setState(response.state); setDirty(false); }
  async function changePassword(currentPassword: string, newPassword: string) { await request("/api/auth/password", { currentPassword, newPassword }); setState(emptyState()); setDirty(false); }
  async function provisionUser(userId: string, password: string) { await request("/api/auth/provision", { userId, password }); }
  return <Context.Provider value={{ state, ready, notice, dirty, setDirty, service, requirePermission, refresh, signIn, signOut, switchOrganization, changePassword, provisionUser }}>{children}</Context.Provider>;
}
export function useDemo() { const value = useContext(Context); if (!value) throw new Error("DemoProvider missing"); return value; }
