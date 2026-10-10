import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: "active" | "graduated";
  mentor: { username: string | null } | null;
  mentee: { username: string | null } | null;
};

export function useMentorships() {
  return useQuery({
    queryKey: ["mentorships"],
    queryFn: async () => {
      return apiRequest<Mentorship[]>("/mentorships");
    },
  });
}

export type DirectoryProfile = {
  id: string;
  username: string;
  department: string | null;
  role: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory: string | null;
  active_title: string | null;
  last_seen_at: string | null;
};

export function useDirectory(options?: Partial<UseQueryOptions<DirectoryProfile[]>>) {
  return useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      return apiRequest<DirectoryProfile[]>("/directory");
    },
    ...options,
  });
}

export function useCreateMentorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mentorId, menteeId }: { mentorId: string; menteeId: string }) => {
      await apiRequest<void>("/mentorships", { method: "POST", body: JSON.stringify({ mentor_id: mentorId, mentee_id: menteeId }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useUpdateMentorshipStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "graduated" }) => {
      await apiRequest<void>(`/mentorships/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useDeleteMentorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/mentorships/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useSetDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, department }: { userId: string; department: string | null }) => {
      await apiRequest<void>(`/admin/users/${userId}/department`, { method: "PATCH", body: JSON.stringify({ department }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory"] }),
  });
}
