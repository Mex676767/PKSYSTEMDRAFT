import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DEFAULT_DEPARTMENTS, DEFAULT_ROLES } from "@/lib/roles";

export type OrgKind = "role" | "department";

/** Roles (most senior first) and departments (A to Z), as managed in Admin. */
export function useOrgStructure() {
  const query = useQuery({
    queryKey: ["org-structure"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [roles, departments] = await Promise.all([
        supabase.from("org_roles").select("name").order("rank"),
        supabase.from("org_departments").select("name").order("name"),
      ]);
      // Before migration 0027 runs these tables don't exist: use the old lists.
      return {
        roles: roles.error ? [...DEFAULT_ROLES] : (roles.data ?? []).map((r) => r.name as string),
        departments: departments.error ? [...DEFAULT_DEPARTMENTS] : (departments.data ?? []).map((d) => d.name as string),
        managed: !roles.error && !departments.error,
      };
    },
  });
  return {
    roles: query.data?.roles ?? [...DEFAULT_ROLES],
    departments: query.data?.departments ?? [...DEFAULT_DEPARTMENTS],
    /** False until migrations 0027/0028 have been run. */
    managed: query.data?.managed ?? false,
    isLoading: query.isLoading,
  };
}

function useOrgMutation<T>(fn: (args: T) => PromiseLike<{ error: unknown }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: T) => {
      const { error } = await fn(args);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-structure"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["all-profiles-admin"] });
    },
  });
}

export function useSaveOrgItem() {
  return useOrgMutation((a: { kind: OrgKind; oldName: string | null; newName: string }) =>
    supabase.rpc("admin_org_save", { kind: a.kind, old_name: a.oldName, new_name: a.newName })
  );
}

export function useMoveOrgItem() {
  return useOrgMutation((a: { kind: OrgKind; name: string; direction: -1 | 1 }) =>
    supabase.rpc("admin_org_move", { kind: a.kind, item_name: a.name, direction: a.direction })
  );
}

export function useDeleteOrgItem() {
  return useOrgMutation((a: { kind: OrgKind; name: string }) =>
    supabase.rpc("admin_org_delete", { kind: a.kind, item_name: a.name })
  );
}
