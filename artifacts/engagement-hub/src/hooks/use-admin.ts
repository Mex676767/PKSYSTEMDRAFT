import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type AdminProfileRow = {
  id: string;
  email: string;
  username: string | null;
  points: number;
  department: string | null;
  role: string | null;
  is_admin: boolean;
  permissions: string[];
  is_deleted: boolean;
  is_hidden?: boolean;
  birthday: string | null;
  is_approved: boolean;
  approved_at: string | null;
};

export function useAllProfiles() {
  return useQuery({
    queryKey: ["all-profiles-admin"],
    queryFn: async () => {
      const [profilesResult, approvalsResult] = await Promise.all([
        supabase.rpc("admin_list_profiles"),
        supabase.rpc("admin_list_profile_approvals"),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (approvalsResult.error && approvalsResult.error.code !== "PGRST202") throw approvalsResult.error;

      if (approvalsResult.error?.code === "PGRST202") {
        return (profilesResult.data as Omit<AdminProfileRow, "is_approved" | "approved_at">[])
          .map((profile) => ({ ...profile, approved_at: null, is_approved: true }));
      }

      const approvals = new Map<string, string | null>(
        (approvalsResult.data ?? []).map((row: { user_id: string; approved_at: string | null }) => [row.user_id, row.approved_at] as const)
      );
      return (profilesResult.data as Omit<AdminProfileRow, "is_approved" | "approved_at">[])
        .map((profile) => {
          const approvedAt = approvals.get(profile.id) ?? null;
          return { ...profile, approved_at: approvedAt, is_approved: approvedAt !== null };
        })
        .sort((a, b) => Number(a.is_approved) - Number(b.is_approved));
    },
  });
}

function useAdminMutation<TVars>(
  fn: (vars: TVars) => Promise<void>,
  extraKeys: string[][] = []
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-profiles-admin"] });
      for (const key of extraKeys) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useAdminSetUsername() {
  return useAdminMutation(async ({ userId, username }: { userId: string; username: string }) => {
    const { error } = await supabase.rpc("admin_set_username", { target_user: userId, new_username: username });
    if (error) throw error;
  });
}

export function useApproveUser() {
  return useAdminMutation(async (userId: string) => {
    const { error } = await supabase.rpc("admin_approve_user", { target_user: userId });
    if (error) throw error;
  }, [["directory"], ["birthdays"], ["giftable-profiles"]]);
}

export function useAdminAdjustPoints() {
  return useAdminMutation(async ({ userId, amount, reason }: { userId: string; amount: number; reason?: string }) => {
    const { error } = await supabase.rpc("admin_adjust_points", { target_user: userId, amount, reason: reason ?? null });
    if (error) throw error;
  });
}

/** Hide an account from everyone else (still active, can still sign in). */
export function useSetUserHidden() {
  return useAdminMutation(async ({ userId, hidden }: { userId: string; hidden: boolean }) => {
    const { error } = await supabase.rpc("admin_set_hidden", { target_user: userId, hidden });
    if (error) throw error;
  }, [["directory"], ["birthdays"], ["giftable-profiles"]]);
}

export function useSetUserAdmin() {
  return useAdminMutation(async ({ userId, value }: { userId: string; value: boolean }) => {
    const { error } = await supabase.rpc("set_user_admin", { target_user: userId, value });
    if (error) throw error;
  });
}

export function useSetUserPermissions() {
  return useAdminMutation(async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
    const { error } = await supabase.rpc("set_user_permissions", { target_user: userId, perms: permissions });
    if (error) throw error;
  });
}

export function useDeactivateUser() {
  return useAdminMutation(async (userId: string) => {
    const { error } = await supabase.rpc("deactivate_user", { target_user: userId });
    if (error) throw error;
  });
}

export function useReactivateUser() {
  return useAdminMutation(async (userId: string) => {
    const { error } = await supabase.rpc("reactivate_user", { target_user: userId });
    if (error) throw error;
  });
}

export function useDeleteOwnAccount() {
  const { signOut } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
    },
    onSuccess: () => signOut(),
  });
}
