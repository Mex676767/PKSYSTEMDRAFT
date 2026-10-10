import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

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

export function useQuizQuestions() {
  return useQuery({
    queryKey: ["quiz-questions"],
    queryFn: () => apiRequest<QuizQuestion[]>("/quiz/questions"),
  });
}

export function useMyQuizAnswers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-quiz-answers", session?.user.id],
    enabled: !!session,
    queryFn: () => apiRequest<QuizAnswer[]>("/quiz/answers/me"),
  });
}

export function useQuizLeaderboard() {
  return useQuery({
    queryKey: ["quiz-leaderboard"],
    queryFn: () => apiRequest<QuizLeaderboardEntry[]>("/quiz/leaderboard"),
  });
}

export function useSubmitQuizAnswer() {
  const { session, refetchProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, selectedIndex }: { questionId: string; selectedIndex: number }) => {
      return apiRequest<{ correct: boolean; correct_index: number }>("/quiz/answers", {
        method: "POST", body: JSON.stringify({ question_id: questionId, selected_index: selectedIndex }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-quiz-answers", session?.user.id] });
      qc.invalidateQueries({ queryKey: ["quiz-leaderboard"] });
      refetchProfile();
    },
  });
}

export function useAllQuizQuestions() {
  return useQuery({
    queryKey: ["quiz-questions-full"],
    queryFn: () => apiRequest<QuizQuestionFull[]>("/admin/quiz/questions"),
  });
}

export function useCreateQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; options: string[]; correctIndex: number }) => {
      return apiRequest<{ id: string }>("/admin/quiz/questions", {
        method: "POST", body: JSON.stringify({ question: input.question, options: input.options, correct_index: input.correctIndex }),
      });
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
    mutationFn: (id: string) => apiRequest(`/admin/quiz/questions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-questions-full"] });
      qc.invalidateQueries({ queryKey: ["quiz-questions"] });
    },
  });
}
