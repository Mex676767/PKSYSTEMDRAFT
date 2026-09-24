import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { MissionCadence } from "@/lib/missions";

export type PointsSettings = { revamp_enabled: boolean; timezone: string };

export type Mission = {
  id: string;
  title: string;
  description: string | null;
  cadence: MissionCadence;
  kind: string;
  target_count: number;
  points: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
};

export type MyMission = Omit<Mission, "active" | "created_at"> & {
  progress: number;
  claim_status: "awarded" | "pending" | "rejected" | null;
  resets_at: string | null;
};

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  stock: number | null;
  active: boolean;
  created_at: string;
};

export type Redemption = {
  id: string;
  reward_id: string | null;
  reward_name: string;
  user_id: string;
  cost: number;
  status: "pending" | "fulfilled" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user?: { username: string | null } | null;
};

export type PendingMissionClaim = {
  id: string;
  points: number;
  created_at: string;
  mission: { title: string } | null;
  user: { username: string | null } | null;
};

const KEYS = {
  settings: ["points-settings"],
  myMissions: ["my-missions"],
  allMissions: ["missions-admin"],
  rewards: ["rewards"],
  myRedemptions: ["my-redemptions"],
  redemptions: ["redemptions-admin"],
  pendingClaims: ["mission-claims-pending"],
};

export function usePointsSettings() {
  const { session } = useAuth();
  return useQuery({
    queryKey: KEYS.settings,
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("points_settings").select("revamp_enabled, timezone").eq("id", 1).maybeSingle();
      // Before the migration runs the table doesn't exist: treat as off.
      if (error) return { revamp_enabled: false, timezone: "Asia/Kuala_Lumpur" } as PointsSettings;
      return (data ?? { revamp_enabled: false, timezone: "Asia/Kuala_Lumpur" }) as PointsSettings;
    },
  });
}

/** True when an admin has switched missions + the rewards shop on. */
export function useRevampEnabled() {
  return usePointsSettings().data?.revamp_enabled ?? false;
}

export function useSetRevampEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("points_settings").update({ revamp_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useMyMissions(enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...KEYS.myMissions, session?.user.id],
    enabled: !!session && enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_missions");
      if (error) throw error;
      return data as MyMission[];
    },
  });
}

function useRefreshPoints() {
  const { refetchProfile } = useAuth();
  const qc = useQueryClient();
  return async () => {
    await refetchProfile();
    qc.invalidateQueries({ queryKey: KEYS.myMissions });
    qc.invalidateQueries({ queryKey: KEYS.myRedemptions });
    qc.invalidateQueries({ queryKey: KEYS.rewards });
    qc.invalidateQueries({ queryKey: ["point-history"] });
  };
}

export function useClaimMission() {
  const refresh = useRefreshPoints();
  return useMutation({
    mutationFn: async (missionId: string) => {
      const { data, error } = await supabase.rpc("claim_mission", { mission_id_param: missionId });
      if (error) throw error;
      return data as "awarded" | "pending";
    },
    onSettled: refresh,
  });
}

export function useRewards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: KEYS.rewards,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").order("cost");
      if (error) throw error;
      return data as Reward[];
    },
  });
}

export function useRedeemReward() {
  const refresh = useRefreshPoints();
  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("redeem_reward", { reward_id_param: rewardId });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useMyRedemptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...KEYS.myRedemptions, session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Redemption[];
    },
  });
}

export function useFullPointHistory() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["point-history", session?.user.id, "full"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("id, amount, reason, created_at")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as { id: string; amount: number; reason: string; created_at: string }[];
    },
  });
}

// ---------------------------------------------------------------- admin

export function useAllMissions() {
  return useQuery({
    queryKey: KEYS.allMissions,
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").order("created_at");
      if (error) throw error;
      return data as Mission[];
    },
  });
}

export type MissionInput = Omit<Mission, "id" | "created_at">;

export function useSaveMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, created_at: _createdAt, ...input }: MissionInput & { id?: string; created_at?: string }) => {
      const { error } = id
        ? await supabase.from("missions").update(input).eq("id", id)
        : await supabase.from("missions").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.allMissions });
      qc.invalidateQueries({ queryKey: KEYS.myMissions });
    },
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.allMissions });
      qc.invalidateQueries({ queryKey: KEYS.myMissions });
    },
  });
}

export type RewardInput = Omit<Reward, "id" | "created_at">;

export function useSaveReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, created_at: _createdAt, ...input }: RewardInput & { id?: string; created_at?: string }) => {
      const { error } = id
        ? await supabase.from("rewards").update(input).eq("id", id)
        : await supabase.from("rewards").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.rewards }),
  });
}

export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.rewards }),
  });
}

export function usePendingMissionClaims() {
  return useQuery({
    queryKey: KEYS.pendingClaims,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_claims")
        .select("id, points, created_at, mission:missions(title), user:profiles!mission_claims_user_id_fkey(username)")
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return data as unknown as PendingMissionClaim[];
    },
  });
}

export function useReviewMissionClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("admin_review_mission_claim", { claim_id_param: id, approve });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.pendingClaims }),
  });
}

export function useAllRedemptions() {
  return useQuery({
    queryKey: KEYS.redemptions,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("*, user:profiles!reward_redemptions_user_id_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Redemption[];
    },
  });
}

export function useReviewRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("admin_review_redemption", { redemption_id_param: id, approve, note: note ?? null });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.redemptions });
      qc.invalidateQueries({ queryKey: KEYS.rewards });
    },
  });
}
