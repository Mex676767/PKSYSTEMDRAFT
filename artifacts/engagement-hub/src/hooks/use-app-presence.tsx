import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { activityLabelForPath } from "@/lib/presence";

const HEARTBEAT_INTERVAL_MS = 45_000;

export type AppPresenceEntry = { path: string; activity: string };

type AppPresenceState = Map<string, AppPresenceEntry>;

const AppPresenceContext = createContext<AppPresenceState>(new Map());

export function AppPresenceProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [location] = useLocation();
  const [presenceMap, setPresenceMap] = useState<AppPresenceState>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("app-presence", { config: { presence: { key: userId } } });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, AppPresenceEntry[]>;
      const map: AppPresenceState = new Map();
      for (const [id, entries] of Object.entries(state)) {
        if (entries[0]) map.set(id, entries[0]);
      }
      setPresenceMap(map);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ path: location, activity: activityLabelForPath(location) });
      }
    });

    supabase.rpc("touch_presence").then(({ error }) => {
      if (error) console.error("Failed to touch presence", error);
    });
    const heartbeat = setInterval(() => {
      supabase.rpc("touch_presence").then(({ error }) => {
        if (error) console.error("Failed to touch presence", error);
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      supabase.rpc("end_my_session").then(({ error }) => {
        if (error) console.error("Failed to end session", error);
      });
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || !channelRef.current) return;
    channelRef.current.track({ path: location, activity: activityLabelForPath(location) });
  }, [location, userId]);

  return <AppPresenceContext.Provider value={presenceMap}>{children}</AppPresenceContext.Provider>;
}

export function useAppPresenceMap() {
  return useContext(AppPresenceContext);
}
