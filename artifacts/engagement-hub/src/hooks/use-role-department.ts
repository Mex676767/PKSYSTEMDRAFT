import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Role, Department } from "@/lib/roles";
import { apiRequest } from "@/lib/api";

export function useSetMyRoleDepartment() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ role, department }: { role: Role; department: Department }) => {
      await apiRequest("/profile/role-department", {
        method: "PUT",
        body: JSON.stringify({ role, department }),
      });
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useAdminSetRoleDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, department }: { userId: string; role: Role | null; department: Department | null }) => {
      await apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/role-department`, {
        method: "PUT",
        body: JSON.stringify({ role, department }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-profiles-admin"] }),
  });
}
