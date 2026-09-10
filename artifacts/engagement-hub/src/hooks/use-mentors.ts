import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: "active" | "graduated";
  mentor: { username: string | null } | null;
  mentee: { username: string | null } | null;
};

const MENTORSHIP_SELECT =
  "*, mentor:profiles!mentorships_mentor_id_fkey(username), mentee:profiles!mentorships_mentee_id_fkey(username)";

export function useMentorships() {
  return useQuery({
    queryKey: ["mentorships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorships")
        .select(MENTORSHIP_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Mentorship[];
    },
  });
}

export type DirectoryProfile = { id: string; username: string; department: string | null; role: string | null };

export function useDirectory() {
  return useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, department, role")
        .not("username", "is", null)
        .order("username");
      if (error) throw error;
      return data as DirectoryProfile[];
    },
  });
}

export function useCreateMentorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mentorId, menteeId }: { mentorId: string; menteeId: string }) => {
      const { error } = await supabase.from("mentorships").insert({ mentor_id: mentorId, mentee_id: menteeId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useUpdateMentorshipStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "graduated" }) => {
      const { error } = await supabase.from("mentorships").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useDeleteMentorship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mentorships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorships"] }),
  });
}

export function useSetDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, department }: { userId: string; department: string | null }) => {
      const { error } = await supabase.rpc("set_user_department", { target_user: userId, dept: department });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory"] }),
  });
}
