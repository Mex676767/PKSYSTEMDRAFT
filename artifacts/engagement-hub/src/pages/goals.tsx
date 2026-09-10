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
const TREE_H = 580;
const CANOPY_CX = 400;
const CANOPY_CY = 215;
const CANOPY_RX = 270;
const CANOPY_RY = 190;

// One big rounded, slightly cloud-like canopy silhouette (not a plain
// ellipse, so it reads as foliage) centered on (0,0) before translating.
const CANOPY_PATH =
  "M -260 10 C -280 -110 -160 -190 -40 -175 C 40 -205 180 -190 230 -90 C 280 -10 260 90 170 150 C 90 210 -90 210 -170 150 C -260 90 -250 60 -260 10 Z";

// Row sizes grow 2,3,4,5 then hold at 5 -- a rough pyramid that fills a
// round canopy without a fixed shape depending on headcount.
function buildRows(total: number) {
  const rows: number[] = [];
  let remaining = total;
  let size = 2;
  while (remaining > 0) {
    const take = Math.min(size, remaining);
    rows.push(take);
    remaining -= take;
    size = Math.min(size + 1, 5);
  }
  return rows;
}

// The "By Person" view as an actual tree illustration: a solid trunk
// growing into one big green canopy, with everyone arranged in branching
// rows inside it (not per-role clusters -- a real tree has one canopy).
function GoalPersonTree({
  groups,
  goalsByOwner,
  onSelect,
}: {
  groups: readonly (readonly [string, DirectoryProfile[]])[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (p: DirectoryProfile) => void;
}) {
  const people = useMemo(() => groups.flatMap(([, ppl]) => ppl), [groups]);

  const layout = useMemo(() => {
    const rows = buildRows(people.length);
    const topY = CANOPY_CY - CANOPY_RY + 55;
    const bottomY = CANOPY_CY + CANOPY_RY - 35;
    let idx = 0;
    const nodes: { p: DirectoryProfile; x: number; y: number }[] = [];
    rows.forEach((count, r) => {
      const rowY = rows.length <= 1 ? (topY + bottomY) / 2 : topY + (r / (rows.length - 1)) * (bottomY - topY);
      const dy = (rowY - CANOPY_CY) / CANOPY_RY;
      const halfW = CANOPY_RX * Math.sqrt(Math.max(0, 1 - dy * dy)) * 0.78;
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? CANOPY_CX : CANOPY_CX - halfW + (i / (count - 1)) * (halfW * 2);
        nodes.push({ p: people[idx], x, y: rowY });
        idx++;
      }
    });
    return nodes;
  }, [people]);

  const trunkTopY = CANOPY_CY + CANOPY_RY - 45;
  const trunkBottomY = TREE_H - 8;

  // A handful of fixed sparkle positions relative to the canopy center --
  // just enough to feel magical without being random/unstable across renders.
  const sparkles = [
    { dx: -190, dy: -100, r: 5 },
    { dx: 150, dy: -130, r: 4 },
    { dx: 210, dy: 30, r: 3.5 },
    { dx: -230, dy: 40, r: 3.5 },
    { dx: 20, dy: -165, r: 4.5 },
  ];

  return (
    <div className="relative mx-auto" style={{ maxWidth: 720, aspectRatio: `${TREE_W} / ${TREE_H}` }}>
      <svg viewBox={`0 0 ${TREE_W} ${TREE_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="tree-canopy-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="55%" stopColor="var(--color-secondary)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
          <linearGradient id="tree-trunk-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
          <filter id="tree-canopy-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>

        {/* Soft glow behind the canopy, matching the app's gradient-card look */}
        <path
          d={CANOPY_PATH}
          transform={`translate(${CANOPY_CX}, ${CANOPY_CY})`}
          fill="url(#tree-canopy-grad)"
          opacity={0.5}
          filter="url(#tree-canopy-glow)"
        />

        <path
          d={`M ${CANOPY_CX - 32} ${trunkBottomY}
              C ${CANOPY_CX - 42} ${trunkBottomY - 70} ${CANOPY_CX - 22} ${trunkTopY + 70} ${CANOPY_CX - 14} ${trunkTopY}
              L ${CANOPY_CX + 14} ${trunkTopY}
              C ${CANOPY_CX + 22} ${trunkTopY + 70} ${CANOPY_CX + 42} ${trunkBottomY - 70} ${CANOPY_CX + 32} ${trunkBottomY}
              Z`}
          fill="url(#tree-trunk-grad)"
        />
        <path
          d={`M ${CANOPY_CX - 30} ${trunkBottomY - 4} L ${CANOPY_CX - 58} ${trunkBottomY + 16}`}
          stroke="url(#tree-trunk-grad)"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path
          d={`M ${CANOPY_CX + 30} ${trunkBottomY - 4} L ${CANOPY_CX + 58} ${trunkBottomY + 16}`}
          stroke="url(#tree-trunk-grad)"
          strokeWidth={9}
          strokeLinecap="round"
        />

        <g stroke="var(--color-accent)" strokeWidth={1.5} opacity={0.5} fill="none">
          {layout.map(({ p, x, y }) => (
            <path key={p.id} d={`M ${CANOPY_CX} ${trunkTopY} Q ${(CANOPY_CX + x) / 2} ${(trunkTopY + y) / 2 + 12} ${x} ${y}`} />
          ))}
        </g>

        {/* Crisp canopy on top of the glow/trunk/branches */}
        <path
          d={CANOPY_PATH}
          transform={`translate(${CANOPY_CX}, ${CANOPY_CY})`}
          fill="url(#tree-canopy-grad)"
        />

        {sparkles.map((s, i) => (
          <circle
            key={i}
            cx={CANOPY_CX + s.dx}
            cy={CANOPY_CY + s.dy}
            r={s.r}
            fill="var(--color-accent)"
            opacity={0.85}
          />
        ))}
      </svg>

      {layout.map(({ p, x, y }) => {
        const count = (goalsByOwner.get(p.id) ?? []).length;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="absolute flex items-center gap-1.5 bg-card border border-border rounded-lg shadow-sm px-2 py-1.5 hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 transition-all"
            style={{ left: `${(x / TREE_W) * 100}%`, top: `${(y / TREE_H) * 100}%`, transform: "translate(-50%, -50%)", maxWidth: 118 }}
          >
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarFallback className={cn("text-white text-[9px] font-bold", colorForId(p.id))}>
                {initialsForUsername(p.username)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left min-w-0">
              <div className="text-[10px] font-medium truncate">@{p.username}</div>
              {p.role && <div className="text-[8px] text-muted-foreground truncate">{p.role}</div>}
            </div>
            {count > 0 && <Badge variant="outline" className="text-[8px] shrink-0 ml-0.5">{count}</Badge>}
          </button>
        );
      })}
    </div>
  );
}
