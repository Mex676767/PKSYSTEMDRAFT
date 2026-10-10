import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

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
    queryFn: async () => (await apiRequest<AdminProfileRow[]>("/admin/profiles"))
      .sort((a, b) => Number(a.is_approved) - Number(b.is_approved)),
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
  return useAdminMutation(({ userId, username }: { userId: string; username: string }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/username`, { method: "PATCH", body: JSON.stringify({ username }) })
  );
}

export function useApproveUser() {
  return useAdminMutation((userId: string) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/approve`, { method: "POST" })
  , [["directory"], ["birthdays"], ["giftable-profiles"]]);
}

export function useAdminAdjustPoints() {
  return useAdminMutation(({ userId, amount, reason }: { userId: string; amount: number; reason?: string }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/points`, { method: "POST", body: JSON.stringify({ amount, reason: reason ?? null }) })
  );
}

/** Hide an account from everyone else (still active, can still sign in). */
export function useSetUserHidden() {
  return useAdminMutation(({ userId, hidden }: { userId: string; hidden: boolean }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/hidden`, { method: "PUT", body: JSON.stringify({ hidden }) })
  , [["directory"], ["birthdays"], ["giftable-profiles"]]);
}

export function useSetUserAdmin() {
  return useAdminMutation(({ userId, value }: { userId: string; value: boolean }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/admin`, { method: "PUT", body: JSON.stringify({ value }) })
  );
}

export function useSetUserPermissions() {
  return useAdminMutation(({ userId, permissions }: { userId: string; permissions: string[] }) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) })
  );
}

export function useDeactivateUser() {
  return useAdminMutation((userId: string) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/active`, { method: "PUT", body: JSON.stringify({ active: false }) })
  );
}

export function useReactivateUser() {
  return useAdminMutation((userId: string) =>
    apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/active`, { method: "PUT", body: JSON.stringify({ active: true }) })
  );
}

export function useDeleteOwnAccount() {
  const { signOut } = useAuth();
  return useMutation({
    mutationFn: () => apiRequest("/account", { method: "DELETE" }),
    onSuccess: () => signOut(),
  });
}
