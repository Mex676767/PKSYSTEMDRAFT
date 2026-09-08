import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type AdminProfileRow = {
  id: string;
  email: string;
  username: string | null;
  points: number;
  department: string | null;
  is_admin: boolean;
  permissions: string[];
  is_deleted: boolean;
  birthday: string | null;
};

export function useAllProfiles() {
  return useQuery({
    queryKey: ["all-profiles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, username, points, department, is_admin, permissions, is_deleted, birthday")
        .order("username");
      if (error) throw error;
      return data as AdminProfileRow[];
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
