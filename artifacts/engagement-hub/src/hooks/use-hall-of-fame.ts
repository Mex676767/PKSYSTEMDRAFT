import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

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
  holder: { username: string | null } | null;
};

const RECORD_SELECT = "*, holder:profiles(username)";

export function useHofCategories() {
  return useQuery({
    queryKey: ["hof-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_categories")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data as HofCategory[];
    },
  });
}

export function useCurrentHofRecords() {
  return useQuery({
    queryKey: ["hof-current-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_records")
        .select(RECORD_SELECT)
        .eq("is_current", true);
      if (error) throw error;
      return data as unknown as HofRecord[];
    },
  });
}

export function useHofRecordHistory(categoryId: string) {
  return useQuery({
    queryKey: ["hof-history", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hof_records")
        .select(RECORD_SELECT)
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as HofRecord[];
    },
  });
}

export function useCreateHofCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string; icon: string }) => {
      const { data, error } = await supabase.from("hof_categories").insert(input).select().single();
      if (error) throw error;
      return data as HofCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hof-categories"] }),
  });
}

export function useSubmitHofRecord(categoryId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (achievement: string) => {
      if (!session) throw new Error("Not signed in");

      // Retire whatever's currently the record for this category before
      // inserting the new one as the current champion.
      const { error: retireError } = await supabase
        .from("hof_records")
        .update({ is_current: false })
        .eq("category_id", categoryId)
        .eq("is_current", true);
      if (retireError) throw retireError;

      const { data, error } = await supabase
        .from("hof_records")
        .insert({ category_id: categoryId, holder_id: session.user.id, achievement, is_current: true })
        .select(RECORD_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as HofRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hof-current-records"] });
      qc.invalidateQueries({ queryKey: ["hof-history", categoryId] });
    },
  });
}
