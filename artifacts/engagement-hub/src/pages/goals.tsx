import { useMemo, useState } from "react";
import { PageTransition } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { cn, getErrorMessage } from "@/lib/utils";

const TERM_ORDER: GoalTerm[] = ["long", "mid", "short"];
const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

type DraftGoal = {
  key: string;
  title: string;
  description: string;
  term: GoalTerm;
  accountability: string;
};

function emptyDraft(): DraftGoal {
  return { key: crypto.randomUUID(), title: "", description: "", term: "short", accountability: "" };
}

export default function Goals() {
  const { session } = useAuth();
  const { data: goals = [], isLoading } = useGoalsFeed();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [showConfetti, setShowConfetti] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [category, setCategory] = useState<GoalCategory>("personal");

  const [newCategory, setNewCategory] = useState<GoalCategory>("personal");
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
          category: newCategory,
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

        <Dialog
          open={isDialogOpen}
          onOpenChange={(o) => {
            setIsDialogOpen(o);
            if (o) {
              setCreateError(null);
              setNewCategory(category);
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
                        value={d.term}
                        onChange={(e) => updateDraft(d.key, { term: e.target.value as GoalTerm })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs ml-auto"
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

      <Tabs value={category} onValueChange={(v) => setCategory(v as GoalCategory)}>
        <div className="flex justify-center">
          <TabsList>
            {CATEGORY_ORDER.map((c) => (
              <TabsTrigger key={c} value={c}>{GOAL_CATEGORY_META[c].label}s</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {CATEGORY_ORDER.map((c) => (
          <TabsContent key={c} value={c} className="pt-6">
            <GoalTree
              category={c}
              goals={goalsByCategory[c]}
              ownerId={session?.user.id}
              onAdvance={handleAdvance}
              updating={updateGoal.isPending}
            />
          </TabsContent>
        ))}
      </Tabs>
    </PageTransition>
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
        <GoalPersonTree groups={byRole} goalsByOwner={goalsByOwner} onSelect={setSelected} />
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

const TREE_W = 800;
const TREE_H = 460;
// A closed, slightly lopsided blob outline centered on (0,0), roughly
// +/-100 wide and +/-65 tall before scaling -- reused per canopy cluster so
// each one doesn't need its own hand-tuned path.
const CANOPY_BLOB =
  "M -88 -8 C -98 -48 -52 -68 -2 -63 C 48 -69 98 -44 94 2 C 99 40 58 64 2 59 C -54 67 -93 34 -88 -8 Z";

// The "By Person" view as an actual illustrated tree (per the user's own
// sketch) instead of plain grouped rows: a trunk, and one leafy canopy
// cluster per role group, with each person as an organic leaf-shaped node
// inside their cluster. Clusters arc across the top like a real canopy;
// with only one group they sit centered above the trunk.
function GoalPersonTree({
  groups,
  goalsByOwner,
  onSelect,
}: {
  groups: readonly (readonly [string, DirectoryProfile[]])[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (p: DirectoryProfile) => void;
}) {
  const clusters = useMemo(() => {
    const n = groups.length;
    return groups.map(([role, people], i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const cx = 130 + t * (TREE_W - 260);
      const cy = 175 - Math.sin(t * Math.PI) * 65;
      const scale = 0.55 + Math.min(people.length, 5) * 0.12;
      return { role, people, cx, cy, scale };
    });
  }, [groups]);

  const trunkX = TREE_W / 2;

  return (
    <div className="relative mx-auto" style={{ maxWidth: 720, aspectRatio: `${TREE_W} / ${TREE_H}` }}>
      <svg viewBox={`0 0 ${TREE_W} ${TREE_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
        <path
          d={`M ${trunkX - 16} ${TREE_H} C ${trunkX - 34} ${TREE_H - 110}, ${trunkX - 8} ${TREE_H - 190}, ${trunkX} ${TREE_H - 255}`}
          stroke="#8b5e34"
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M ${trunkX + 16} ${TREE_H} C ${trunkX + 30} ${TREE_H - 110}, ${trunkX + 6} ${TREE_H - 190}, ${trunkX} ${TREE_H - 255}`}
          stroke="#6f4a29"
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
        {clusters.map((c) => (
          <path
            key={c.role}
            d={CANOPY_BLOB}
            transform={`translate(${c.cx}, ${c.cy}) scale(${c.scale})`}
            className="fill-primary/15"
          />
        ))}
      </svg>

      {clusters.map((c) => (
        <div
          key={c.role}
          className="absolute flex flex-col items-center gap-1.5"
          style={{ left: `${(c.cx / TREE_W) * 100}%`, top: `${(c.cy / TREE_H) * 100}%`, transform: "translate(-50%, -50%)", width: 190 }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 rounded-full">
            {c.role}
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {c.people.map((p) => {
              const count = (goalsByOwner.get(p.id) ?? []).length;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="flex items-center gap-1.5 bg-card border border-primary/25 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 transition-all px-2.5 py-1.5"
                  style={{ borderRadius: "63% 37% 54% 46% / 43% 47% 53% 57%" }}
                >
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarFallback className={cn("text-white text-[9px] font-bold", colorForId(p.id))}>
                      {initialsForUsername(p.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium">@{p.username}</span>
                  {count > 0 && <Badge variant="outline" className="text-[9px] shrink-0">{count}</Badge>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
