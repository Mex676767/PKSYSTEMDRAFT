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

export function AppPresenceProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [location] = useLocation();
  const [presenceMap, setPresenceMap] = useState<AppPresenceState>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;

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
        // The synced state is authoritative for everyone else, but don't let it
        // regress our own entry if it hasn't caught up with our latest track() yet.
        map.set(userId, { path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        setPresenceMap(map);
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          markSelfPresent();
          await channel!.track({ path: locationRef.current, activity: activityLabelForPath(locationRef.current) });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (channelRef.current === channel) channelRef.current = null;
          if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
    };

    connect();
    markSelfPresent();

    supabase.rpc("touch_presence").then(({ error }) => {
      if (error) console.error("Failed to touch presence", error);
    });
    const heartbeat = setInterval(() => {
      supabase.rpc("touch_presence").then(({ error }) => {
        if (error) console.error("Failed to touch presence", error);
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(heartbeat);
      supabase.rpc("end_my_session").then(({ error }) => {
        if (error) console.error("Failed to end session", error);
      });
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
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
