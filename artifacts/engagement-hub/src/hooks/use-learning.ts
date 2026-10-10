import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type Person = {
  id?: string;
  username: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory?: string | null;
  department?: string | null;
};

export type LearningResource = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string | null;
  created_by: string;
  created_at: string;
  author: Person | null;
};

export type LearningRequest = {
  id: string;
  user_id: string;
  course_name: string;
  course_url: string | null;
  reason: string;
  benefit: string;
  estimated_cost: number | null;
  status: "pending" | "sponsored" | "declined";
  review_note: string | null;
  created_at: string;
  requester: Person | null;
  reviewer: Person | null;
};

export type LearningShare = {
  id: string;
  user_id: string;
  title: string;
  learned: string;
  benefit: string;
  resource_url: string | null;
  created_at: string;
  author: Person | null;
};

export function useLearningResources() {
  return useQuery({
    queryKey: ["learning-resources"],
    queryFn: async () => {
      return apiRequest<LearningResource[]>("/learning/resources");
    },
  });
}

export function useCreateLearningResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description: string; category: string; url?: string }) => {
      await apiRequest("/learning/resources", { method: "POST", body: JSON.stringify({ title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), url: input.url?.trim() || null }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-resources"] }),
  });
}

export function useDeleteLearningResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/learning/resources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-resources"] }),
  });
}

export function useLearningRequests() {
  return useQuery({
    queryKey: ["learning-requests"],
    queryFn: async () => {
      return apiRequest<LearningRequest[]>("/learning/requests");
    },
  });
}

export function useCreateLearningRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      courseName: string;
      courseUrl?: string;
      reason: string;
      benefit: string;
      estimatedCost?: number | null;
    }) => {
      await apiRequest("/learning/requests", { method: "POST", body: JSON.stringify({ course_name: input.courseName.trim(), course_url: input.courseUrl?.trim() || null, reason: input.reason.trim(), benefit: input.benefit.trim(), estimated_cost: input.estimatedCost ?? null }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useReviewLearningRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "sponsored" | "declined"; note?: string }) => {
      await apiRequest<void>(`/learning/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status, review_note: note?.trim() || null }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useDeleteLearningRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/learning/requests/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useLearningShares() {
  return useQuery({
    queryKey: ["learning-shares"],
    queryFn: async () => {
      return apiRequest<LearningShare[]>("/learning/shares");
    },
  });
}

export function useCreateLearningShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; learned: string; benefit: string; resourceUrl?: string }) => {
      await apiRequest("/learning/shares", { method: "POST", body: JSON.stringify({ title: input.title.trim(), learned: input.learned.trim(), benefit: input.benefit.trim(), resource_url: input.resourceUrl?.trim() || null }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-shares"] }),
  });
}

export function useDeleteLearningShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/learning/shares/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-shares"] }),
  });
}
