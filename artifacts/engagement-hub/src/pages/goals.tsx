import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";
import { GoalCard } from "@/components/goal-card";
import { motion } from "framer-motion";
import { Plus, Target, Trophy, Flame } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGoalsFeed, useCreateGoal, useUpdateGoal, GOAL_TERM_META, type GoalTerm } from "@/hooks/use-goals";

const TERM_ORDER: { term: GoalTerm; icon: typeof Trophy }[] = [
  { term: "long", icon: Trophy },
  { term: "mid", icon: Flame },
  { term: "short", icon: Target },
];

export default function Goals() {
  const { session } = useAuth();
  const { data: goals = [], isLoading } = useGoalsFeed();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [showConfetti, setShowConfetti] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTerm, setNewTerm] = useState<GoalTerm>("short");
  const [newDate, setNewDate] = useState("");

  const handleAdvance = (id: string, currentProgress: number) => {
    const newProgress = Math.min(100, currentProgress + 25);
    const isNowCompleted = newProgress === 100;

    if (isNowCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    updateGoal.mutate({ id, updates: { progress: newProgress, completed: isNowCompleted } });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createGoal.mutate(
      {
        title: newTitle,
        description: newDesc,
        term: newTerm,
        target_date: newDate || null,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewTitle("");
          setNewDesc("");
          setNewDate("");
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <Confetti active={showConfetti} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground mt-1">
            Everyone's goals, out in the open. Cheer each other on.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 hover-elevate" disabled={!session}>
              <Plus className="w-4 h-4 mr-2" /> New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="e.g., Ship feature X"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Details..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Term</label>
                <div className="flex gap-2">
                  {TERM_ORDER.map(({ term }) => (
                    <Button
                      key={term}
                      type="button"
                      size="sm"
                      variant={newTerm === term ? "default" : "outline"}
                      onClick={() => setNewTerm(term)}
                      className="flex-1"
                    >
                      {GOAL_TERM_META[term].label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{GOAL_TERM_META[newTerm].sub}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target date (optional)</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={createGoal.isPending}>
                {createGoal.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!session && (
        <div className="p-4 text-center bg-muted/30 border border-dashed rounded-2xl text-sm text-muted-foreground">
          Sign in to post your own goals, comment, or react.
        </div>
      )}

      <div className="space-y-10">
        {TERM_ORDER.map(({ term, icon: Icon }) => {
          const termGoals = goals.filter((g) => g.term === term);
          const meta = GOAL_TERM_META[term];

          return (
            <div key={term}>
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" /> {meta.label} Goals
                </h2>
                <span className="text-xs text-muted-foreground">{meta.sub}</span>
              </div>

              {termGoals.length === 0 ? (
                <div className="p-6 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground text-sm">
                  No {meta.label.toLowerCase()} goals posted yet.
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
                  {termGoals.map((goal) => (
                    <motion.div key={goal.id} variants={slideUp}>
                      <GoalCard
                        goal={goal}
                        isOwner={goal.owner_id === session?.user.id}
                        onAdvance={() => handleAdvance(goal.id, goal.progress)}
                        updating={updateGoal.isPending}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </PageTransition>
  );
}
