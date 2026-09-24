import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TITLE_CATALOG } from "@/lib/titles";

export type Achievement = { key: string; label: string; description: string; builtin: boolean };

const FALLBACK: Achievement[] = Object.entries(TITLE_CATALOG).map(([key, v]) => ({ key, label: v.label, description: v.description, builtin: true }));

/** The achievements catalog (built-in + ones admins added), with lookups. */
export function useAchievements() {
  const query = useQuery({
    queryKey: ["achievements"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements").select("key, label, description, builtin").order("created_at");
      // Before migration 0029 runs the table doesn't exist: use the built-in list.
      if (error) return { list: FALLBACK, managed: false };
      return { list: data as Achievement[], managed: true };
    },
  });
  const list = query.data?.list ?? FALLBACK;
  const byKey = new Map(list.map((a) => [a.key, a]));
  return {
    achievements: list,
    managed: query.data?.managed ?? false,
    label: (key: string) => byKey.get(key)?.label ?? TITLE_CATALOG[key]?.label ?? key,
    description: (key: string) => byKey.get(key)?.description ?? TITLE_CATALOG[key]?.description ?? "",
  };
}

function useAchievementMutation<T>(fn: (args: T) => PromiseLike<{ error: unknown }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: T) => {
      const { error } = await fn(args);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["achievement-holders"] });
    },
  });
}

function slug(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "achievement";
}

export function useSaveAchievement() {
  return useAchievementMutation((a: { key?: string; label: string; description: string }) =>
    a.key
      ? supabase.from("achievements").update({ label: a.label.trim(), description: a.description.trim() }).eq("key", a.key)
      : supabase.from("achievements").insert({ key: `${slug(a.label)}_${Date.now().toString(36)}`, label: a.label.trim(), description: a.description.trim() })
  );
}

export function useDeleteAchievement() {
  return useAchievementMutation((key: string) => supabase.from("achievements").delete().eq("key", key));
}

export function useSetAchievement() {
  return useAchievementMutation((a: { userId: string; key: string; hasIt: boolean }) =>
    supabase.rpc("admin_set_achievement", { target_user: a.userId, achievement_key: a.key, has_it: a.hasIt })
  );
}

export type AchievementHolder = { id: string; username: string | null; avatar_url: string | null; unlocked_titles: string[] };

/** Everyone's unlocked achievements, for the admin panel. */
export function useAchievementHolders(enabled: boolean) {
  return useQuery({
    queryKey: ["achievement-holders"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, unlocked_titles")
        .not("username", "is", null)
        .order("username");
      if (error) throw error;
      return data as AchievementHolder[];
    },
  });
}
