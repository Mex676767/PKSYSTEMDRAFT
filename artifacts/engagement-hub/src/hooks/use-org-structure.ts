import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DEPARTMENTS, DEFAULT_ROLES } from "@/lib/roles";
import { apiRequest } from "@/lib/api";

export type OrgKind = "role" | "department";

/** Roles (most senior first) and departments (A to Z), as managed in Admin. */
export function useOrgStructure() {
  const query = useQuery({
    queryKey: ["org-structure"],
    staleTime: 5 * 60_000,
    queryFn: () => apiRequest<{ roles: string[]; departments: string[]; managed: boolean }>("/org-structure"),
  });
  return {
    roles: query.data?.roles ?? [...DEFAULT_ROLES],
    departments: query.data?.departments ?? [...DEFAULT_DEPARTMENTS],
    /** False until migrations 0027/0028 have been run. */
    managed: query.data?.managed ?? false,
    isLoading: query.isLoading,
  };
}

function useOrgMutation<T>(fn: (args: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: T) => {
      await fn(args);
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
    apiRequest("/admin/org-structure", { method: "POST", body: JSON.stringify({ kind: a.kind, old_name: a.oldName, new_name: a.newName }) })
  );
}

export function useMoveOrgItem() {
  return useOrgMutation((a: { kind: OrgKind; name: string; direction: -1 | 1 }) =>
    apiRequest("/admin/org-structure/order", { method: "PUT", body: JSON.stringify(a) })
  );
}

export function useDeleteOrgItem() {
  return useOrgMutation((a: { kind: OrgKind; name: string }) =>
    apiRequest(`/admin/org-structure/${encodeURIComponent(a.kind)}/${encodeURIComponent(a.name)}`, { method: "DELETE" })
  );
}
