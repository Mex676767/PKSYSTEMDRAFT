import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

// Only used by the admin/manage_quiz question-management UI -- includes
// correct_index, which the player-facing get_quiz_questions() RPC omits.
export type QuizQuestionFull = QuizQuestion & {
  correct_index: number;
  created_at: string;
};

export type QuizAnswer = {
  question_id: string;
  selected_index: number;
  correct: boolean;
};

export type QuizLeaderboardEntry = {
  user_id: string;
  username: string;
  correct_count: number;
  total_answered: number;
};

// Player-facing: never exposes correct_index.
export function useQuizQuestions() {
  return useQuery({
    queryKey: ["quiz-questions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quiz_questions");
      if (error) throw error;
      return data as QuizQuestion[];
    },
  });
}

export function useMyQuizAnswers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-quiz-answers", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_answers")
        .select("question_id, selected_index, correct")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return data as QuizAnswer[];
    },
  });
}

export function useQuizLeaderboard() {
  return useQuery({
    queryKey: ["quiz-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quiz_leaderboard");
      if (error) throw error;
      return data as QuizLeaderboardEntry[];
    },
  });
}

export function useSubmitQuizAnswer() {
  const { session, refetchProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, selectedIndex }: { questionId: string; selectedIndex: number }) => {
      const { data, error } = await supabase.rpc("submit_quiz_answer", {
        question_id_param: questionId,
        selected_index_param: selectedIndex,
      });
      if (error) throw error;
      return data as { correct: boolean; correct_index: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-quiz-answers", session?.user.id] });
      qc.invalidateQueries({ queryKey: ["quiz-leaderboard"] });
      refetchProfile();
    },
  });
}

// ---- Question management (manage_quiz permission only, enforced by RLS) ----

export function useAllQuizQuestions() {
  return useQuery({
    queryKey: ["quiz-questions-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QuizQuestionFull[];
    },
  });
}

export function useCreateQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; options: string[]; correctIndex: number }) => {
      const { session } = (await supabase.auth.getSession()).data;
      const { error } = await supabase.from("quiz_questions").insert({
        question: input.question,
        options: input.options,
        correct_index: input.correctIndex,
        created_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-questions-full"] });
      qc.invalidateQueries({ queryKey: ["quiz-questions"] });
    },
  });
}

export function useDeleteQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-questions-full"] });
      qc.invalidateQueries({ queryKey: ["quiz-questions"] });
    },
  });
}
