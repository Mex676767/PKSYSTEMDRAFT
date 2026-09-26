import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

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

const PERSON_SELECT = "username,avatar_url,active_border,active_accessory,department";

export function useLearningResources() {
  return useQuery({
    queryKey: ["learning-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_resources")
        .select(`*, author:profiles!learning_resources_created_by_fkey(${PERSON_SELECT})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LearningResource[];
    },
  });
}

export function useCreateLearningResource() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description: string; category: string; url?: string }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("learning_resources").insert({
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
        url: input.url?.trim() || null,
        created_by: session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-resources"] }),
  });
}

export function useDeleteLearningResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-resources"] }),
  });
}

export function useLearningRequests() {
  return useQuery({
    queryKey: ["learning-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_requests")
        .select(`*, requester:profiles!learning_requests_user_id_fkey(${PERSON_SELECT}), reviewer:profiles!learning_requests_reviewed_by_fkey(${PERSON_SELECT})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LearningRequest[];
    },
  });
}

export function useCreateLearningRequest() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      courseName: string;
      courseUrl?: string;
      reason: string;
      benefit: string;
      estimatedCost?: number | null;
    }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("learning_requests").insert({
        user_id: session.user.id,
        course_name: input.courseName.trim(),
        course_url: input.courseUrl?.trim() || null,
        reason: input.reason.trim(),
        benefit: input.benefit.trim(),
        estimated_cost: input.estimatedCost ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useReviewLearningRequest() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "sponsored" | "declined"; note?: string }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase
        .from("learning_requests")
        .update({
          status,
          review_note: note?.trim() || null,
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useDeleteLearningRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-requests"] }),
  });
}

export function useLearningShares() {
  return useQuery({
    queryKey: ["learning-shares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_shares")
        .select(`*, author:profiles!learning_shares_user_id_fkey(${PERSON_SELECT})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LearningShare[];
    },
  });
}

export function useCreateLearningShare() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; learned: string; benefit: string; resourceUrl?: string }) => {
      if (!session) throw new Error("Not signed in");
      const { error } = await supabase.from("learning_shares").insert({
        user_id: session.user.id,
        title: input.title.trim(),
        learned: input.learned.trim(),
        benefit: input.benefit.trim(),
        resource_url: input.resourceUrl?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-shares"] }),
  });
}

export function useDeleteLearningShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-shares"] }),
  });
}
