import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type HofCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
};

export type HofRecord = {
  id: string;
  category_id: string;
  holder_id: string;
  achievement: string;
  record_date: string;
  is_current: boolean;
  created_at: string;
  holder: { username: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null; department: string | null } | null;
};

export function useHofCategories() {
  return useQuery({
    queryKey: ["hof-categories"],
    queryFn: () => apiRequest<HofCategory[]>("/guinness/categories"),
  });
}

export function useCurrentHofRecords() {
  return useQuery({
    queryKey: ["hof-current-records"],
    queryFn: () => apiRequest<HofRecord[]>("/guinness/records/current"),
  });
}

export function useHofRecordHistory(categoryId: string) {
  return useQuery({
    queryKey: ["hof-history", categoryId],
    queryFn: () => apiRequest<HofRecord[]>(`/guinness/records/history/${encodeURIComponent(categoryId)}`),
  });
}

export function useAllUsernames() {
  return useQuery({
    queryKey: ["all-usernames"],
    queryFn: () => apiRequest<{ id: string; username: string }[]>("/guinness/usernames"),
  });
}

export function useCreateHofCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string; icon: string }) =>
      apiRequest<HofCategory>("/guinness/categories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hof-categories"] }),
  });
}

export function useSubmitHofRecord(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ achievement, holderId }: { achievement: string; holderId: string }) =>
      apiRequest<HofRecord>("/guinness/records", { method: "POST", body: JSON.stringify({ category_id: categoryId, holder_id: holderId, achievement }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-current-records"] });
      qc.invalidateQueries({ queryKey: ['hof-deletion-logs'] });
      qc.invalidateQueries({ queryKey: ["hof-history", categoryId] });
    },
  });
}

export function useDeleteHofRecord(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => apiRequest(`/guinness/records/${encodeURIComponent(recordId)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-current-records"] });
      qc.invalidateQueries({ queryKey: ['hof-deletion-logs'] });
      qc.invalidateQueries({ queryKey: ["hof-history", categoryId] });
    },
  });
}

export function useDeleteHofCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => apiRequest(`/guinness/categories/${encodeURIComponent(categoryId)}`, { method: "DELETE" }),
    onSuccess: () => {
      for (const key of ["hof-categories", "hof-current-records", "hof-history", "hof-deletion-logs"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
