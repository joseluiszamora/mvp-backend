"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { accentStorageKey, isAccentColor } from "@/lib/appearance";
import { DemoError, permissionFor, seedDemo, defaultPreferences, type AuditEvent, type DemoState, type Permission, type Preferences } from "@/lib/demo";
import { createPreferenceQueue, mergePanelState, panelFreshnessMs, ReadCache } from "@/lib/panel-client";
import { createMockService, type MockService } from "@/lib/demo-service";

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
  const stateRef = useRef(state);
  stateRef.current = state;
  const readsCache = useRef(new ReadCache());
  const snapshotAt = useRef(0);
  const epoch = useRef(0);
  const confirmedPreferences = useRef<DemoState["preferences"]>({});
  const preferenceVersion = useRef(0);
  const pendingPreferences = useRef<{ key: string; changes: Partial<Preferences> } | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const acceptState = useCallback((incoming: DemoState, force = false, preservePreferences = false) => {
    readsCache.current.clear();
    snapshotAt.current = Date.now();
    const sameScope = incoming.accountId === stateRef.current.accountId && incoming.organizationId === stateRef.current.organizationId;
    if (!preservePreferences || !sameScope) confirmedPreferences.current = incoming.preferences;
    const pending = pendingPreferences.current;
    const preferences = preservePreferences && sameScope ? stateRef.current.preferences : pending && incoming.accountId && pending.key === `${incoming.accountId}:${incoming.organizationId}`
      ? { ...incoming.preferences, [pending.key]: { ...(incoming.preferences[pending.key] ?? defaultPreferences()), ...pending.changes } }
      : incoming.preferences;
    const next = force ? { ...incoming, preferences } : mergePanelState(stateRef.current, { ...incoming, preferences });
    stateRef.current = next;
    setState(next);
  }, []);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const refresh = useCallback((): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const generation = epoch.current;
    const preferencesAtStart = preferenceVersion.current;
    const task = (async () => {
      try {
        const result = await request<{ state: DemoState }>("/api/panel");
        if (generation !== epoch.current) return;
        acceptState(result.state, true, preferencesAtStart !== preferenceVersion.current); setNotice("");
      } catch (error) {
        if (generation !== epoch.current) return;
        if (error instanceof DemoError && error.message === "Sesión requerida.") acceptState(emptyState());
        else setNotice(error instanceof Error ? error.message : "No se pudo cargar el panel.");
      } finally { if (generation === epoch.current) setReady(true); }
    })();
    refreshInFlight.current = task;
    void task.finally(() => { if (refreshInFlight.current === task) refreshInFlight.current = null; });
    return task;
  }, [acceptState]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!ready || !state.accountId) return;
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [ready, state.accountId, refresh]);
  useEffect(() => { if (!ready) return; applyAccents(state); const org = state.organizations.find((item) => item.id === state.organizationId); let icon = document.querySelector<HTMLLinkElement>('link[data-panel-favicon="true"]'); if (org?.favicon && state.accountId) { if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; icon.dataset.panelFavicon = "true"; document.head.appendChild(icon); } icon.href = org.favicon; } else icon?.remove(); }, [state, ready]);
  const service = useMemo<MockService>(() => {
    let mutationQueue: Promise<void> = Promise.resolve();
    const reads = new Set(["listUsers", "listRoles", "listFiles", "listNotifications", "listAudit"]);
    const persistPreference = createPreferenceQueue(async (scope, changes) => {
      const [accountId, organizationId, generation] = JSON.parse(scope) as [string, string, number];
      if (epoch.current !== generation || stateRef.current.accountId !== accountId) throw new DemoError("DENIED", "La sesión cambió antes de guardar la preferencia.");
      const response = await request<{ patch: Partial<DemoState>; auditEvent?: AuditEvent }>("/api/panel", { method: "updatePreferences", args: [organizationId, changes] });
      if (epoch.current !== generation) throw new DemoError("DENIED", "La sesión cambió durante el guardado.");
      const key = `${accountId}:${organizationId}`;
      const preference = response.patch.preferences?.[key];
      if (!preference) throw new DemoError("SERVICE", "No se pudo guardar la preferencia.");
      confirmedPreferences.current = { ...confirmedPreferences.current, [key]: preference };
      if (response.auditEvent) {
        readsCache.current.invalidate((cacheKey) => JSON.parse(cacheKey)[2] === "listAudit");
        const next = mergePanelState(stateRef.current, { audit: [response.auditEvent, ...stateRef.current.audit.filter((item) => item.id !== response.auditEvent!.id)].slice(0, 500) });
        stateRef.current = next; setState(next);
      }
      return preference;
    });
    async function updatePreferences(organizationId: string, changes: Partial<Preferences>) {
      const current = stateRef.current;
      if (organizationId !== current.organizationId || !current.accountId) throw new DemoError("DENIED", "Empresa no autorizada.");
      const key = `${current.accountId}:${organizationId}`;
      const version = ++preferenceVersion.current;
      const generation = epoch.current;
      pendingPreferences.current = { key, changes: { ...(pendingPreferences.current?.key === key ? pendingPreferences.current.changes : {}), ...changes } };
      const optimistic = mergePanelState(current, { preferences: { ...current.preferences, [key]: { ...(current.preferences[key] ?? defaultPreferences()), ...changes } } });
      stateRef.current = optimistic; setState(optimistic);
      try {
        const preference = await persistPreference(JSON.stringify([current.accountId, organizationId, generation]), changes);
        if (generation !== epoch.current || version !== preferenceVersion.current) return;
        pendingPreferences.current = null;
        setNotice("");
        setState((previous) => mergePanelState(previous, { preferences: { ...previous.preferences, [key]: preference } }));
      } catch (error) {
        if (generation === epoch.current && version === preferenceVersion.current) {
          pendingPreferences.current = null;
          setState((previous) => mergePanelState(previous, { preferences: { ...previous.preferences, [key]: confirmedPreferences.current[key] ?? defaultPreferences() } }));
          setNotice(error instanceof Error ? error.message : "No se pudo guardar la preferencia.");
        }
        throw error;
      }
    }
    async function call<T>(method: keyof MockService, ...args: unknown[]): Promise<T> {
      const current = stateRef.current;
      const generation = epoch.current;
      const preferencesAtStart = preferenceVersion.current;
      if (reads.has(method)) {
        const key = JSON.stringify([current.accountId, current.organizationId, method, args]);
        const now = Date.now();
        const remaining = snapshotAt.current + panelFreshnessMs - now;
        return readsCache.current.get(key, async () => {
          // La carga inicial ya contiene estas listas autorizadas. No pedirlas de nuevo.
          if (Date.now() - snapshotAt.current < panelFreshnessMs && (method !== "listAudit" || current.audit.length < 500)) {
            const local = createMockService(() => current, () => { throw new Error("Servicio de solo lectura."); });
            const read = local[method] as (...parameters: unknown[]) => Promise<T>;
            return read(...args);
          }
          const response = await request<{ result: T }>("/api/panel", { method, args });
          return response.result;
        }, now, remaining > 0 ? remaining : panelFreshnessMs);
      }
      const task = mutationQueue.then(() => {
        if (generation !== epoch.current) throw new DemoError("DENIED", "La sesión cambió antes de completar la operación.");
        return request<{ result: T; state: DemoState }>("/api/panel", { method, args });
      });
      mutationQueue = task.then(() => {}, () => {});
      const response = await task;
      if (generation === epoch.current) acceptState(response.state, false, preferencesAtStart !== preferenceVersion.current);
      return response.result;
    }
    return {
      listUsers: (query) => call("listUsers", query), saveUser: (input) => call("saveUser", input), changeUserStatus: (organizationId, ids) => call("changeUserStatus", organizationId, ids),
      listRoles: (organizationId) => call("listRoles", organizationId), createRole: (organizationId, name) => call("createRole", organizationId, name), setRolePermission: (organizationId, roleId, code, enabled) => call("setRolePermission", organizationId, roleId, code, enabled),
      listFiles: (organizationId, query) => call("listFiles", organizationId, query), addFile: (organizationId, file) => call("addFile", organizationId, file), renameFile: (organizationId, id, name) => call("renameFile", organizationId, id, name), deleteFile: (organizationId, id) => call("deleteFile", organizationId, id),
      listNotifications: (organizationId) => call("listNotifications", organizationId), markNotifications: (organizationId, ids) => call("markNotifications", organizationId, ids), listAudit: (organizationId, query) => call("listAudit", organizationId, query),
      updateOrganization: (organizationId, changes) => call("updateOrganization", organizationId, changes), addBranch: (organizationId, name) => call("addBranch", organizationId, name), updateBranch: (organizationId, id, changes) => call("updateBranch", organizationId, id, changes),
      updatePreferences, updateProfile: (changes) => call("updateProfile", changes),
    };
  }, [acceptState]);
  const requirePermission = useCallback((permission: Permission) => { if (!permissionFor(state, permission)) throw new DemoError("DENIED", "No tienes permiso para esta acción."); }, [state]);
  function resetRequests() {
    epoch.current++; preferenceVersion.current++; snapshotAt.current = 0;
    pendingPreferences.current = null; readsCache.current.clear(); refreshInFlight.current = null;
  }
  async function signIn(email: string, password: string) { const response = await request<{ state: DemoState }>("/api/auth/login", { email, password }); resetRequests(); acceptState(response.state); setReady(true); setNotice(""); setDirty(false); }
  async function signOut() { resetRequests(); acceptState(emptyState()); try { await request("/api/auth/logout", {}); } finally { acceptState(emptyState()); setDirty(false); } }
  async function switchOrganization(id: string) { resetRequests(); setReady(false); try { const response = await request<{ state: DemoState }>("/api/auth/organization", { organizationId: id }); acceptState(response.state); setDirty(false); } finally { setReady(true); } }
  async function changePassword(currentPassword: string, newPassword: string) { await request("/api/auth/password", { currentPassword, newPassword }); resetRequests(); acceptState(emptyState()); setDirty(false); }
  async function provisionUser(userId: string, password: string) { await request("/api/auth/provision", { userId, password }); }
  return <Context.Provider value={{ state, ready, notice, dirty, setDirty, service, requirePermission, refresh, signIn, signOut, switchOrganization, changePassword, provisionUser }}>{children}</Context.Provider>;
}
export function useDemo() { const value = useContext(Context); if (!value) throw new Error("DemoProvider missing"); return value; }
