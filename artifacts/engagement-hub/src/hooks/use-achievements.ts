import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TITLE_CATALOG } from "@/lib/titles";
import { apiRequest } from "@/lib/api";

export type Achievement = { key: string; label: string; description: string; builtin: boolean };

const FALLBACK: Achievement[] = Object.entries(TITLE_CATALOG).map(([key, v]) => ({ key, label: v.label, description: v.description, builtin: true }));

/** The achievements catalog (built-in + ones admins added), with lookups. */
export function useAchievements() {
  const query = useQuery({
    queryKey: ["achievements"],
    staleTime: 5 * 60_000,
    queryFn: async () => ({ list: await apiRequest<Achievement[]>("/achievements"), managed: true }),
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

function useAchievementMutation<T>(fn: (args: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: T) => {
      await fn(args);
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
  return useAchievementMutation((a: { key?: string; label: string; description: string }) => {
    const body = JSON.stringify({ label: a.label.trim(), description: a.description.trim() });
    return a.key
      ? apiRequest(`/admin/achievements/${encodeURIComponent(a.key)}`, { method: "PATCH", body })
      : apiRequest("/admin/achievements", { method: "POST", body: JSON.stringify({ key: `${slug(a.label)}_${Date.now().toString(36)}`, label: a.label.trim(), description: a.description.trim() }) });
  });
}

export function useDeleteAchievement() {
  return useAchievementMutation((key: string) => apiRequest(`/admin/achievements/${encodeURIComponent(key)}`, { method: "DELETE" }));
}

export function useSetAchievement() {
  return useAchievementMutation((a: { userId: string; key: string; hasIt: boolean }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(a.userId)}/achievements`, { method: "PUT", body: JSON.stringify({ key: a.key, has_it: a.hasIt }) })
  );
}

export type AchievementHolder = { id: string; username: string | null; avatar_url: string | null; unlocked_titles: string[] };

/** Everyone's unlocked achievements, for the admin panel. */
export function useAchievementHolders(enabled: boolean) {
  return useQuery({
    queryKey: ["achievement-holders"],
    enabled,
    queryFn: () => apiRequest<AchievementHolder[]>("/admin/achievement-holders"),
  });
}
