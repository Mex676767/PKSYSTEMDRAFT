import { useMemo, useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Confetti } from "@/components/confetti";
import { GoalCard } from "@/components/goal-card";
import { motion } from "framer-motion";
import { Plus, Target, Trophy, Flame, Rows3, Network, Search } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useGoalsFeed,
  useCreateGoal,
  useUpdateGoal,
  GOAL_TERM_META,
  GOAL_CATEGORY_META,
  type GoalTerm,
  type GoalCategory,
  type Goal,
} from "@/hooks/use-goals";
import { useDirectory, type DirectoryProfile } from "@/hooks/use-mentors";
import { ROLES } from "@/lib/roles";
import { cn, getErrorMessage } from "@/lib/utils";

const TERM_ORDER: { term: GoalTerm; icon: typeof Trophy }[] = [
  { term: "long", icon: Trophy },
  { term: "mid", icon: Flame },
  { term: "short", icon: Target },
];

const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

export default function Goals() {
  const { session } = useAuth();
  const { data: goals = [], isLoading } = useGoalsFeed();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [showConfetti, setShowConfetti] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [category, setCategory] = useState<GoalCategory>("personal");
  const [view, setView] = useState<"feed" | "tree">("feed");

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTerm, setNewTerm] = useState<GoalTerm>("short");
  const [newCategory, setNewCategory] = useState<GoalCategory>("personal");
  const [newAccountability, setNewAccountability] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

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
    if (newTerm === "short" && !newAccountability.trim()) return;
    setCreateError(null);

    createGoal.mutate(
      {
        title: newTitle,
        description: newDesc,
        term: newTerm,
        category: newCategory,
        accountability: newTerm === "short" ? newAccountability.trim() : null,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewTitle("");
          setNewDesc("");
          setNewAccountability("");
        },
        onError: (err) => setCreateError(getErrorMessage(err)),
      }
    );
  };

  const goalsByCategory = useMemo(() => {
    const map: Record<GoalCategory, Goal[]> = { personal: [], career: [] };
    for (const g of goals) {
      // Goals created before the category column existed have no value here
      // -- fall back to personal (matching the column's own DB default)
      // instead of crashing on an unrecognized key.
      const cat: GoalCategory = g.category === "career" ? "career" : "personal";
      map[cat].push(g);
    }
    return map;
  }, [goals]);

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

        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (o) setCreateError(null); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0 hover-elevate" disabled={!session} onClick={() => setNewCategory(category)}>
              <Plus className="w-4 h-4 mr-2" /> New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <div className="flex gap-2">
                  {CATEGORY_ORDER.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={newCategory === c ? "default" : "outline"}
                      onClick={() => setNewCategory(c)}
                      className="flex-1"
                    >
                      {GOAL_CATEGORY_META[c].label}
                    </Button>
                  ))}
                </div>
              </div>
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
              {newTerm === "short" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Accountability action</label>
                  <textarea
                    value={newAccountability}
                    onChange={(e) => setNewAccountability(e.target.value)}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="What will you actually do to hold yourself accountable?"
                    required
                  />
                </div>
              )}
              {createError && <p className="text-sm text-destructive">{createError}</p>}
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

      <Tabs value={category} onValueChange={(v) => setCategory(v as GoalCategory)}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <TabsList>
            {CATEGORY_ORDER.map((c) => (
              <TabsTrigger key={c} value={c}>{GOAL_CATEGORY_META[c].label}s</TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
            <button
              onClick={() => setView("feed")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                view === "feed" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <Rows3 className="w-3.5 h-3.5" /> Feed
            </button>
            <button
              onClick={() => setView("tree")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                view === "tree" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <Network className="w-3.5 h-3.5" /> By Person
            </button>
          </div>
        </div>

        {CATEGORY_ORDER.map((c) => (
          <TabsContent key={c} value={c} className="pt-6">
            {view === "feed" ? (
              <GoalFeed
                goals={goalsByCategory[c]}
                ownerId={session?.user.id}
                onAdvance={handleAdvance}
                updating={updateGoal.isPending}
              />
            ) : (
              <GoalTree
                category={c}
                goals={goalsByCategory[c]}
                ownerId={session?.user.id}
                onAdvance={handleAdvance}
                updating={updateGoal.isPending}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageTransition>
  );
}

function GoalFeed({
  goals,
  ownerId,
  onAdvance,
  updating,
}: {
  goals: Goal[];
  ownerId: string | undefined;
  onAdvance: (id: string, currentProgress: number) => void;
  updating: boolean;
}) {
  return (
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
                      isOwner={goal.owner_id === ownerId}
                      onAdvance={() => onAdvance(goal.id, goal.progress)}
                      updating={updating}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GoalTree({
  category,
  goals,
  ownerId,
  onAdvance,
  updating,
}: {
  category: GoalCategory;
  goals: Goal[];
  ownerId: string | undefined;
  onAdvance: (id: string, currentProgress: number) => void;
  updating: boolean;
}) {
  const { data: directory = [] } = useDirectory();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DirectoryProfile | null>(null);

  const goalsByOwner = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of goals) {
      if (!map.has(g.owner_id)) map.set(g.owner_id, []);
      map.get(g.owner_id)!.push(g);
    }
    return map;
  }, [goals]);

  const q = search.trim().toLowerCase();
  const filtered = directory.filter((p) => !q || p.username.toLowerCase().includes(q));

  const byRole = useMemo(() => {
    const map = new Map<string, DirectoryProfile[]>();
    for (const p of filtered) {
      const key = p.role ?? "Unranked";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...ROLES, "Unranked"]
      .filter((r) => map.has(r))
      .map((r) => [r, map.get(r)!] as const);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative w-full sm:w-64 mx-auto">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find someone..."
          className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {byRole.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No one matches "{search}".</div>
      ) : (
        <div className="space-y-6">
          {byRole.map(([role, people]) => (
            <div key={role}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center mb-3">{role}</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {people.map((p) => {
                  const count = (goalsByOwner.get(p.id) ?? []).length;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className={cn("text-white text-[10px] font-bold", colorForId(p.id))}>
                          {initialsForUsername(p.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left min-w-0">
                        <div className="text-sm font-medium truncate">@{p.username}</div>
                        <div className="text-[10px] text-muted-foreground">{p.role ?? "No role"}</div>
                      </div>
                      {count > 0 && <Badge variant="outline" className="text-[9px] ml-1 shrink-0">{count}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>@{selected.username}'s {GOAL_CATEGORY_META[category].label}s</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 max-h-[65vh] overflow-y-auto pr-1">
                {(goalsByOwner.get(selected.id) ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No goals posted yet.</p>
                ) : (
                  TERM_ORDER.map(({ term }) => {
                    const termGoals = (goalsByOwner.get(selected.id) ?? []).filter((g) => g.term === term);
                    if (termGoals.length === 0) return null;
                    return (
                      <div key={term} className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {GOAL_TERM_META[term].label}
                        </h4>
                        {termGoals.map((goal) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            isOwner={goal.owner_id === ownerId}
                            onAdvance={() => onAdvance(goal.id, goal.progress)}
                            updating={updating}
                          />
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
