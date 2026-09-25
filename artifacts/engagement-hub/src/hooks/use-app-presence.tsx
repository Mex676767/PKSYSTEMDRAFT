import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { activityLabelForPath } from "@/lib/presence";

const HEARTBEAT_INTERVAL_MS = 45_000;
const RECONNECT_DELAY_MS = 3_000;

export type AppPresenceEntry = { path: string; activity: string };

type AppPresenceState = Map<string, AppPresenceEntry>;

const AppPresenceContext = createContext<AppPresenceState>(new Map());

function isPageActive() {
  return document.visibilityState === "visible" && document.hasFocus();
}

export function AppPresenceProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [location] = useLocation();
  const [presenceMap, setPresenceMap] = useState<AppPresenceState>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isActiveRef = useRef(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let channel: RealtimeChannel | null = null;
    let subscribed = false;

    // We always know our own presence -- reflect it locally right away instead
    // of waiting on the realtime round-trip, so a slow/dropped/erroring
    // subscription never leaves us showing as offline to ourselves.
    const markSelfPresent = () => {
      setPresenceMap((prev) => {
        const next = new Map(prev);
        next.set(userId, { path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        return next;
      });
    };

    const markSelfAbsent = () => {
      setPresenceMap((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    const touchPresence = () => {
      supabase.rpc("touch_presence").then(({ error }) => {
        if (error) console.error("Failed to touch presence", error);
      });
    };

    const startHeartbeat = () => {
      if (heartbeatTimer) return;
      touchPresence();
      heartbeatTimer = setInterval(touchPresence, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (!heartbeatTimer) return;
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    };

    const updateActivity = () => {
      if (cancelled) return;
      const active = isPageActive();
      if (active === isActiveRef.current) return;
      isActiveRef.current = active;

      if (active) {
        markSelfPresent();
        startHeartbeat();
        if (subscribed) {
          channel?.track({ path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        }
      } else {
        markSelfAbsent();
        stopHeartbeat();
        if (subscribed) channel?.untrack();
      }
    };

    const connect = () => {
      if (cancelled) return;

      channel = supabase.channel("app-presence", { config: { presence: { key: userId } } });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel!.presenceState() as Record<string, AppPresenceEntry[]>;
        const map: AppPresenceState = new Map();
        for (const [id, entries] of Object.entries(state)) {
          if (entries[0]) map.set(id, entries[0]);
        }
        // The synced state is authoritative for everyone else. Only keep our
        // local entry while this tab is visible and focused.
        if (isActiveRef.current) {
          map.set(userId, { path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        } else {
          map.delete(userId);
        }
        setPresenceMap(map);
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          if (isActiveRef.current) {
            markSelfPresent();
            await channel!.track({ path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribed = false;
          if (channelRef.current === channel) channelRef.current = null;
          if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
    };

    isActiveRef.current = isPageActive();
    connect();
    if (isActiveRef.current) {
      markSelfPresent();
      startHeartbeat();
    } else {
      markSelfAbsent();
    }

    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", updateActivity);

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopHeartbeat();
      document.removeEventListener("visibilitychange", updateActivity);
      window.removeEventListener("focus", updateActivity);
      window.removeEventListener("blur", updateActivity);
      supabase.rpc("end_my_session").then(({ error }) => {
        if (error) console.error("Failed to end session", error);
      });
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !isActiveRef.current) return;
    const entry = { path: location, activity: activityLabelForPath(location) };
    setPresenceMap((prev) => {
      const next = new Map(prev);
      next.set(userId, entry);
      return next;
    });
    channelRef.current?.track(entry);
  }, [location, userId]);

  return <AppPresenceContext.Provider value={presenceMap}>{children}</AppPresenceContext.Provider>;
}

export function useAppPresenceMap() {
  return useContext(AppPresenceContext);
}
