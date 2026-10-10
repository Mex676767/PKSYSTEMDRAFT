import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api";
import { activityLabelForPath } from "@/lib/presence";

const HEARTBEAT_INTERVAL_MS = 60_000;
const POLL_INTERVAL_MS = 15_000;
export type AppPresenceEntry = { path: string; activity: string };
type AppPresenceState = Map<string, AppPresenceEntry>;
type PresenceResponse = { user_id: string; path: string; activity: string };
const AppPresenceContext = createContext<AppPresenceState>(new Map());

function isPageActive() {
  return document.visibilityState === "visible" && document.hasFocus();
}

function getClientId() {
  const key = "eh-presence-client-id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export function AppPresenceProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [location] = useLocation();
  const [presenceMap, setPresenceMap] = useState<AppPresenceState>(new Map());
  const clientId = useMemo(() => typeof window === "undefined" ? "" : getClientId(), []);
  const isActiveRef = useRef(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (!userId || !clientId) return;
    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const setSelf = (present: boolean) => setPresenceMap((current) => {
      const next = new Map(current);
      if (present) next.set(userId, { path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
      else next.delete(userId);
      return next;
    });

    const publishPresence = () => {
      if (!isActiveRef.current || cancelled) return;
      void apiRequest<void>("/presence/me", {
        method: "PUT",
        body: JSON.stringify({ client_id: clientId, path: locationRef.current, activity: activityLabelForPath(locationRef.current) }),
      }).catch((error) => console.error("Failed to update app presence", error));
    };

    const startHeartbeat = () => {
      if (heartbeatTimer) return;
      publishPresence();
      heartbeatTimer = setInterval(publishPresence, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      void apiRequest<void>(`/presence/me/${clientId}`, { method: "DELETE" }).catch(() => undefined);
    };

    const updateActivity = () => {
      const active = isPageActive();
      if (active === isActiveRef.current) return;
      isActiveRef.current = active;
      setSelf(active);
      if (active) startHeartbeat(); else stopHeartbeat();
    };

    const poll = async () => {
      try {
        const remote = await apiRequest<PresenceResponse[]>("/presence");
        if (cancelled) return;
        const next = new Map(remote.map((entry) => [entry.user_id, { path: entry.path, activity: entry.activity }]));
        if (isActiveRef.current) next.set(userId, { path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        setPresenceMap(next);
      } catch {
        // Keep the latest presence view during a brief API interruption.
      }
    };

    isActiveRef.current = isPageActive();
    if (isActiveRef.current) { setSelf(true); startHeartbeat(); }
    void poll();
    const pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", updateActivity);

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", updateActivity);
      window.removeEventListener("focus", updateActivity);
      window.removeEventListener("blur", updateActivity);
      void apiRequest<void>(`/presence/me/${clientId}`, { method: "DELETE" }).catch(() => undefined);
    };
  }, [userId, clientId]);

  useEffect(() => {
    if (!userId || !isActiveRef.current) return;
    setPresenceMap((current) => {
      const next = new Map(current);
      next.set(userId, { path: location, activity: activityLabelForPath(location) });
      return next;
    });
    if (clientId) {
      void apiRequest<void>("/presence/me", {
        method: "PUT",
        body: JSON.stringify({ client_id: clientId, path: location, activity: activityLabelForPath(location) }),
      }).catch(() => undefined);
    }
  }, [location, userId, clientId]);

  return <AppPresenceContext.Provider value={presenceMap}>{children}</AppPresenceContext.Provider>;
}

export function useAppPresenceMap() {
  return useContext(AppPresenceContext);
}
