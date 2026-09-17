import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { buildDiscordAuthorizeUrl, type DiscordPresence } from "@/lib/discord";

export function useDiscordPresenceMap() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`rt-discord-presence-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "discord_presence" }, () => {
        qc.invalidateQueries({ queryKey: ["discord-presence"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["discord-presence"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discord_presence").select("*");
      if (error) throw error;
      const map = new Map<string, DiscordPresence>();
      for (const row of data as DiscordPresence[]) map.set(row.user_id, row);
      return map;
    },
    refetchInterval: 30_000,
  });
}

export function connectDiscord() {
  window.location.href = buildDiscordAuthorizeUrl();
}
