import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { Role, Department } from "@/lib/roles";

export function useSetMyRoleDepartment() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ role, department }: { role: Role; department: Department }) => {
      const { error } = await supabase.rpc("set_my_role_department", {
        role_param: role,
        department_param: department,
      });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useAdminSetRoleDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, department }: { userId: string; role: Role | null; department: Department | null }) => {
      const { error } = await supabase.rpc("admin_set_role_department", {
        user_id_param: userId,
        role_param: role,
        department_param: department,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-profiles-admin"] }),
  });
}
