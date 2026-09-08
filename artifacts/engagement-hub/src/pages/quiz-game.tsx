import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, Trophy, Plus, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useQuizQuestions,
  useMyQuizAnswers,
  useSubmitQuizAnswer,
  useQuizLeaderboard,
  useAllQuizQuestions,
  useCreateQuizQuestion,
  useDeleteQuizQuestion,
} from "@/hooks/use-quiz";
import { cn } from "@/lib/utils";

export default function QuizGame() {
  const { session, hasPermission } = useAuth();
  const canManage = hasPermission("manage_quiz");

  const { data: questions = [], isLoading } = useQuizQuestions();
  const { data: myAnswers = [] } = useMyQuizAnswers();
  const { data: leaderboard = [] } = useQuizLeaderboard();

  const answeredMap = new Map(myAnswers.map((a) => [a.question_id, a]));

  return (
    <PageTransition className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Games
      </Link>

      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="w-7 h-7 text-primary" /> Brand Knowledge Quiz
        </h1>
        <p className="text-muted-foreground mt-1">How well do you really know us?</p>
      </div>

      {canManage && <QuestionManager />}

      {!session ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Sign in to play.</CardContent></Card>
      ) : isLoading ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>
      ) : questions.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          No questions yet. {canManage ? "Add the first one above." : "Check back soon."}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
          {questions.map((q) => (
            <motion.div key={q.id} variants={slideUp}>
              <QuestionCard question={q} existingAnswer={answeredMap.get(q.id)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <Card className="border-accent/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-accent-foreground" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No one's answered yet. Be first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <span className="font-medium text-sm">@{entry.username}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {entry.correct_count} / {entry.total_answered} correct
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function QuestionCard({
  question,
  existingAnswer,
}: {
  question: { id: string; question: string; options: string[] };
  existingAnswer: { selected_index: number; correct: boolean } | undefined;
}) {
  const submitAnswer = useSubmitQuizAnswer();
  const [localResult, setLocalResult] = useState<{ correct: boolean; correct_index: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const answered = existingAnswer ?? (localResult && selected !== null ? { selected_index: selected, correct: localResult.correct } : undefined);
  const revealedCorrectIndex = localResult?.correct_index;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    submitAnswer.mutate(
      { questionId: question.id, selectedIndex: index },
      { onSuccess: (res) => setLocalResult(res) }
    );
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold text-sm">{question.question}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options.map((opt, i) => {
            const isSelected = answered?.selected_index === i;
            const isCorrectOption = revealedCorrectIndex === i;
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={!!answered || submitAnswer.isPending}
                className={cn(
                  "flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors",
                  !answered && "hover:bg-muted/50 border-border",
                  answered && isSelected && answered.correct && "bg-emerald-500/15 border-emerald-500/40",
                  answered && isSelected && !answered.correct && "bg-destructive/15 border-destructive/40",
                  answered && !isSelected && isCorrectOption && "bg-emerald-500/10 border-emerald-500/30",
                  answered && !isSelected && !isCorrectOption && "border-border/50 text-muted-foreground"
                )}
              >
                <span>{opt}</span>
                {answered && isSelected && (answered.correct ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-destructive shrink-0" />)}
                {answered && !isSelected && isCorrectOption && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionManager() {
  const { data: allQuestions = [] } = useAllQuizQuestions();
  const createQuestion = useCreateQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();
  const [expanded, setExpanded] = useState(false);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.some((o) => !o.trim())) return;
    createQuestion.mutate(
      { question: question.trim(), options: options.map((o) => o.trim()), correctIndex },
      {
        onSuccess: () => {
          setQuestion("");
          setOptions(["", "", "", ""]);
          setCorrectIndex(0);
        },
      }
    );
  };

  return (
    <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/10 via-card to-card">
      <CardHeader className="pb-3">
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center justify-between w-full">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="text-[10px]">Manage</Badge> Quiz Questions ({allQuestions.length})
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  className="shrink-0"
                  title="Mark as correct answer"
                />
                <input
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  required
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Select the radio next to the correct option.</p>
            <Button type="submit" size="sm" disabled={createQuestion.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Question
            </Button>
          </form>

          {allQuestions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              {allQuestions.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg bg-muted/40">
                  <span className="truncate">{q.question}</span>
                  <button
                    onClick={() => window.confirm("Delete this question?") && deleteQuestion.mutate(q.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
