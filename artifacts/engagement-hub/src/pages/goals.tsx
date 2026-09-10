import { useMemo, useState } from "react";
import { PageTransition } from "@/components/animations";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";
import { GoalCard } from "@/components/goal-card";
import { Plus, Search, X } from "lucide-react";
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
import { getErrorMessage } from "@/lib/utils";

const TERM_ORDER: GoalTerm[] = ["long", "mid", "short"];
const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

// A spread of distinct, vivid hues -- deliberately NOT the app's
// purple/pink/gold theme gradient -- cycled per role band so this reads as
// colorful/playful rather than monochrome.
const ROLE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

type DraftGoal = {
  key: string;
  title: string;
  description: string;
  term: GoalTerm;
  category: GoalCategory;
  accountability: string;
};

function emptyDraft(): DraftGoal {
  return { key: crypto.randomUUID(), title: "", description: "", term: "short", category: "personal", accountability: "" };
}

export default function Goals() {
  const { session } = useAuth();
  const { data: goals = [], isLoading: goalsLoading } = useGoalsFeed();
  const { data: directory = [], isLoading: directoryLoading } = useDirectory();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [showConfetti, setShowConfetti] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DirectoryProfile | null>(null);

  const [drafts, setDrafts] = useState<DraftGoal[]>([emptyDraft()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdvance = (id: string, currentProgress: number) => {
    const newProgress = Math.min(100, currentProgress + 25);
    const isNowCompleted = newProgress === 100;

    if (isNowCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    updateGoal.mutate({ id, updates: { progress: newProgress, completed: isNowCompleted } });
  };

  const updateDraft = (key: string, patch: Partial<DraftGoal>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const addDraft = () => setDrafts((prev) => [...prev, emptyDraft()]);
  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = drafts.filter((d) => d.title.trim());
    if (valid.length === 0) return;

    const missingAccountability = valid.find((d) => d.term === "short" && !d.accountability.trim());
    if (missingAccountability) {
      setCreateError(`"${missingAccountability.title}" needs an accountability action since it's short-term.`);
      return;
    }

    setCreateError(null);
    setIsSubmitting(true);
    const results = await Promise.allSettled(
      valid.map((d) =>
        createGoal.mutateAsync({
          title: d.title.trim(),
          description: d.description.trim(),
          term: d.term,
          category: d.category,
          accountability: d.term === "short" ? d.accountability.trim() : null,
        })
      )
    );
    setIsSubmitting(false);

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const firstError = (failed[0] as PromiseRejectedResult).reason;
      setCreateError(
        `${failed.length} of ${valid.length} goal${valid.length === 1 ? "" : "s"} failed to save (${getErrorMessage(firstError)}). The rest were created.`
      );
      return;
    }

    setIsDialogOpen(false);
    setDrafts([emptyDraft()]);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  if (goalsLoading || directoryLoading) {
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

        <Dialog
          open={isDialogOpen}
          onOpenChange={(o) => {
            setIsDialogOpen(o);
            if (o) {
              setCreateError(null);
              setDrafts([emptyDraft()]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0 hover-elevate" disabled={!session}>
              <Plus className="w-4 h-4 mr-2" /> Add Goals
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Goals</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground -mt-2">
                Mix Personal and Career goals in one go -- each one below picks its own category.
              </p>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {drafts.map((d, i) => (
                  <div key={d.key} className="rounded-lg border border-border p-3 space-y-2 relative">
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDraft(d.key)}
                        className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex items-center gap-2 pr-6">
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">Goal {i + 1}</span>
                      <select
                        value={d.category}
                        onChange={(e) => updateDraft(d.key, { category: e.target.value as GoalCategory })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs ml-auto"
                      >
                        {CATEGORY_ORDER.map((c) => (
                          <option key={c} value={c}>{GOAL_CATEGORY_META[c].label}</option>
                        ))}
                      </select>
                      <select
                        value={d.term}
                        onChange={(e) => updateDraft(d.key, { term: e.target.value as GoalTerm })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {TERM_ORDER.map((term) => (
                          <option key={term} value={term}>{GOAL_TERM_META[term].label}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={d.title}
                      onChange={(e) => updateDraft(d.key, { title: e.target.value })}
                      placeholder="e.g., Ship feature X"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <textarea
                      value={d.description}
                      onChange={(e) => updateDraft(d.key, { description: e.target.value })}
                      placeholder="Details..."
                      className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">{GOAL_TERM_META[d.term].sub}</p>
                    {d.term === "short" && (
                      <textarea
                        value={d.accountability}
                        onChange={(e) => updateDraft(d.key, { accountability: e.target.value })}
                        placeholder="Accountability action -- what will you actually do to hold yourself to this?"
                        className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addDraft} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Goal
              </Button>

              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                {isSubmitting
                  ? "Creating..."
                  : drafts.filter((d) => d.title.trim()).length > 1
                    ? `Create ${drafts.filter((d) => d.title.trim()).length} Goals`
                    : "Create Goal"}
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
          {byRole.map(([role, people], i) => {
            const color = ROLE_COLORS[i % ROLE_COLORS.length];
            return (
              <div key={role}>
                <div className="flex justify-center mb-3">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide text-white px-3 py-1 rounded-full shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {role}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {people.map((p) => {
                    const count = (goalsByOwner.get(p.id) ?? []).length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                      >
                        <UserAvatar
                          user={{ initials: initialsForUsername(p.username), color: colorForId(p.id), name: p.username }}
                          photoUrl={p.avatar_url}
                          border={p.active_border}
                          className="w-8 h-8"
                        />
                        <div className="text-left min-w-0">
                          <div className="text-sm font-medium truncate">@{p.username}</div>
                          <div className="text-[10px] text-muted-foreground">{p.role ?? "No role"}</div>
                        </div>
                        {count > 0 && <Badge variant="outline" className="text-[9px] shrink-0 ml-0.5">{count}</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>@{selected.username}'s Goals</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 max-h-[65vh] overflow-y-auto pr-1">
                {(goalsByOwner.get(selected.id) ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No goals posted yet.</p>
                ) : (
                  TERM_ORDER.map((term) => {
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
                            isOwner={goal.owner_id === session?.user.id}
                            onAdvance={() => handleAdvance(goal.id, goal.progress)}
                            updating={updateGoal.isPending}
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
    </PageTransition>
  );
}
