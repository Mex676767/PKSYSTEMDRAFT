import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/confetti";
import { ArrowLeft, Type, Clock, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useTodayWordleAttempts,
  useTodayWordleResult,
  useSubmitWordleGuess,
  useWordleLeaderboard,
  type LetterStatus,
} from "@/hooks/use-wordle";
import { cn, getErrorMessage } from "@/lib/utils";

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

const STATUS_CLASS: Record<LetterStatus, string> = {
  correct: "bg-emerald-500 border-emerald-500 text-white",
  present: "bg-amber-400 border-amber-400 text-white",
  absent: "bg-muted border-border text-muted-foreground",
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function WordleGame() {
  const { session } = useAuth();
  const { data: attempts = [], isLoading: loadingAttempts } = useTodayWordleAttempts();
  const { data: result } = useTodayWordleResult();
  const submitGuess = useSubmitWordleGuess();
  const { data: leaderboard = [] } = useWordleLeaderboard();

  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealedTarget, setRevealedTarget] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const finished = !!result;
  const rowsUsed = attempts.length;

  useEffect(() => {
    if (finished || attempts.length === 0) return;
    const start = new Date(attempts[0].created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempts, finished]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (current.length !== WORD_LENGTH) return;
    setError(null);
    submitGuess.mutate(current, {
      onSuccess: (res) => {
        setCurrent("");
        if (res.target) setRevealedTarget(res.target);
      },
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  const emptyRows = Math.max(0, MAX_GUESSES - rowsUsed - (finished ? 0 : 1));

  const durationDisplay = useMemo(() => {
    if (result?.duration_seconds != null) return formatDuration(result.duration_seconds);
    return null;
  }, [result]);

  return (
    <PageTransition className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <Confetti active={!!result?.solved} />

      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Games
      </Link>

      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          <Type className="w-7 h-7 text-primary" /> Fastest Wordle Guesser
        </h1>
        <p className="text-muted-foreground mt-1">One 5-letter word a day. 6 tries. Go.</p>
      </div>

      {!session ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Sign in to play today's puzzle.</CardContent></Card>
      ) : loadingAttempts ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>
      ) : (
        <>
          <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="p-6 space-y-4">
              {!finished && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" /> {elapsed}s elapsed
                </div>
              )}

              <div className="space-y-2 max-w-xs mx-auto">
                {attempts.map((a) => (
                  <div key={a.id} className="grid grid-cols-5 gap-2">
                    {a.statuses.map((status, i) => (
                      <div
                        key={i}
                        className={cn(
                          "aspect-square rounded-lg border-2 flex items-center justify-center text-xl font-black uppercase",
                          STATUS_CLASS[status]
                        )}
                      >
                        {a.guess[i]}
                      </div>
                    ))}
                  </div>
                ))}

                {!finished && (
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: WORD_LENGTH }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg border-2 border-border flex items-center justify-center text-xl font-black uppercase"
                      >
                        {current[i] ?? ""}
                      </div>
                    ))}
                  </div>
                )}

                {Array.from({ length: emptyRows }).map((_, r) => (
                  <div key={r} className="grid grid-cols-5 gap-2">
                    {Array.from({ length: WORD_LENGTH }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-lg border-2 border-border/40" />
                    ))}
                  </div>
                ))}
              </div>

              {finished ? (
                <div className="text-center space-y-2 pt-2">
                  {result?.solved ? (
                    <p className="font-bold text-lg text-emerald-600">
                      🎉 Solved in {result.guess_count} guess{result.guess_count === 1 ? "" : "es"}
                      {durationDisplay && ` (${durationDisplay})`}!
                    </p>
                  ) : (
                    <p className="font-bold text-lg text-muted-foreground">
                      Out of guesses. The word was <span className="uppercase text-foreground">{revealedTarget ?? "?"}</span>.
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">Come back tomorrow for a new word.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-2 max-w-xs mx-auto">
                  <input
                    value={current}
                    onChange={(e) => setCurrent(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, WORD_LENGTH).toLowerCase())}
                    placeholder="guess"
                    autoFocus
                    className="flex-1 h-11 rounded-md border border-input bg-background px-3 text-center text-lg font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="submit" disabled={current.length !== WORD_LENGTH || submitGuess.isPending}>
                    {submitGuess.isPending ? "..." : "Guess"}
                  </Button>
                </form>
              )}

              {error && <p className="text-sm text-destructive text-center">{error}</p>}
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-accent" /> Today's Fastest Guessers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No one's solved it yet today. Be first!</p>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <motion.div
                      key={entry.user_id}
                      variants={slideUp}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <span className="font-medium text-sm">@{entry.profile?.username ?? "unknown"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{entry.guess_count} guess{entry.guess_count === 1 ? "" : "es"}</span>
                        <span className="font-semibold text-foreground">
                          {entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : "—"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageTransition>
  );
}
