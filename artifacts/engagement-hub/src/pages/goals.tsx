import { useMemo, useState } from "react";
import { PageTransition } from "@/components/animations";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";
import { GoalCard } from "@/components/goal-card";
import { GoalsTreeView } from "@/components/goals-tree-view";
import { TreeDetailPanel } from "@/components/goals-tree-panel";
import { Plus, Search, X, MessageCircle, ListChecks, Send, LayoutGrid, TreeDeciduous, Trash2 } from "lucide-react";
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
import { useComments, useAddComment, useDeleteComment } from "@/hooks/use-social";
import { ReactionBar } from "@/components/social/reaction-bar";
import { useDirectory, type DirectoryProfile } from "@/hooks/use-mentors";
import { uploadProgressPhoto } from "@/hooks/use-progress-photos";
import { ImagePickerButton } from "@/components/image-picker-button";
import { ROLES } from "@/lib/roles";
import { cn, getErrorMessage } from "@/lib/utils";

const TERM_ORDER: GoalTerm[] = ["long", "mid", "short"];
const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

type DraftGoal = {
  key: string;
  title: string;
  description: string;
  term: GoalTerm;
  category: GoalCategory;
  accountability: string;
  imageFile: File | null;
  imagePreview: string | null;
};

function emptyDraft(): DraftGoal {
  return {
    key: crypto.randomUUID(),
    title: "",
    description: "",
    term: "short",
    category: "personal",
    accountability: "",
    imageFile: null,
    imagePreview: null,
  };
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
  const [view, setView] = useState<"card" | "tree">("card");

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
  const setDraftImage = (key: string, file: File | null) =>
    updateDraft(key, { imageFile: file, imagePreview: file ? URL.createObjectURL(file) : null });

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

    // Best-effort: a goal that saved but whose photo failed to attach still
    // counts as created (it can always get a photo added afterward from its
    // card) -- so this never turns a successful goal into a reported failure.
    if (session) {
      await Promise.allSettled(
        results.map((r, i) => {
          const draft = valid[i];
          if (r.status !== "fulfilled" || !draft.imageFile) return Promise.resolve();
          return uploadProgressPhoto({
            targetType: "goal",
            targetId: r.value.id,
            file: draft.imageFile,
            userId: session.user.id,
          });
        })
      );
    }

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

  // No more grouping by role -- just a stable, sensible order (rank, then
  // name) so the grid fills side by side instead of fragmenting into
  // mostly-single-card "rows" per role.
  const sortedPeople = useMemo(() => {
    const rankOf = (role: string | null) => {
      const idx = ROLES.indexOf(role as (typeof ROLES)[number]);
      return idx === -1 ? ROLES.length : idx;
    };
    return [...filtered].sort(
      (a, b) => rankOf(a.role) - rankOf(b.role) || a.username.localeCompare(b.username)
    );
  }, [filtered]);

  if (goalsLoading || directoryLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  // Shared between the plain in-flow header (below lg, and Card View at any
  // size) and the version overlaid directly on the tree art at lg+ (see
  // GoalsTreeView's `header` prop) -- same controls, same bound state,
  // rendered at two different places in the tree rather than duplicated by
  // hand so they can't drift apart.
  const toggleButtons = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setView("tree")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
          view === "tree"
            ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-md"
            : "border border-border text-muted-foreground hover:text-foreground"
        )}
      >
        <TreeDeciduous className="w-4 h-4" /> Tree View
      </button>
      <button
        type="button"
        onClick={() => setView("card")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
          view === "card"
            ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-md"
            : "border border-border text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="w-4 h-4" /> Card View
      </button>
    </div>
  );

  const searchInput = (
    <div className="relative w-full sm:w-72">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find someone..."
        className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background/90 backdrop-blur-sm text-sm"
      />
    </div>
  );

  const headingBlock = () => (
    <div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Goals</h1>
      <p className="text-muted-foreground mt-1">Everyone's goals, out in the open. Cheer each other on.</p>
    </div>
  );

  return (
    <>
      {/* Rendered outside PageTransition on purpose: that wrapper animates
          with framer-motion, and any transformed ancestor becomes the
          containing block for `fixed` descendants -- nested inside it, this
          button would position relative to PageTransition's own box instead
          of the viewport, landing well below the notification/theme icons
          instead of next to them. Docks at top-4 right-[124px], just left
          of those icons (top-4 right-4 / right-[68px]). Mobile keeps the
          plain in-flow button below instead -- there's no room to spare
          next to the icons on a narrow screen.
          Inline `position: fixed, zIndex: 50` because the `.hover-elevate`
          utility class (`.hover-elevate:not(.no-default-hover-elevate) {
          position: relative; z-index: 0; }`) beats the plain `fixed`/`z-50`
          Tailwind classes on BOTH properties at higher CSS specificity (a
          `:not()` selector counts as an extra class), silently winning over
          them otherwise -- without the zIndex override too, this button was
          painting behind the tree hero's own z-30 header overlay despite
          `z-50` in its className, since Tree View now overlays real content
          directly on top of this same corner instead of leaving it as the
          topmost fixed layer over a separate backdrop. Plain solid button,
          no frosted backing needed -- the tree scene no longer has a blurred
          backdrop bleeding up behind this corner, so nothing washes it out. */}
      <Button
        onClick={() => setIsDialogOpen(true)}
        disabled={!session}
        style={{ position: "fixed", zIndex: 50 }}
        className="hidden md:inline-flex top-4 right-[124px] z-50 hover-elevate"
      >
        <Plus className="w-4 h-4 mr-2" /> Add Goals
      </Button>

      {/* md:-mt-16 cancels Shell's pt-16 (there to clear the fixed
          notification/theme icons) -- now that Add Goals docks next to those
          icons instead of reaching for them from the page's own header, the
          Goals title has nothing left near that corner and doesn't need the
          clearance, so this un-does the big gap above the heading on desktop.
          Tree View drops max-w/mx-auto (both themes) so the section can
          stretch to the full width of <main> -- no leftover page-background
          gutters on wide screens. */}
      <PageTransition
        className={cn(
          "p-4 md:p-8 md:-mt-16 space-y-8",
          view !== "tree" && "max-w-[100rem] mx-auto"
        )}
      >
      <Confetti active={showConfetti} />

      {/* Mounted once regardless of view/breakpoint -- it's a modal overlay,
          so where it lives in the tree doesn't affect where it appears. */}
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

                    {d.imagePreview ? (
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        <img src={d.imagePreview} alt="" className="w-full max-h-40 object-cover" />
                        <button
                          type="button"
                          onClick={() => setDraftImage(d.key, null)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <ImagePickerButton onImage={(file) => setDraftImage(d.key, file)} label="Photo" />
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

      {!session && (
        <div className="p-4 text-center bg-muted/30 border border-dashed rounded-2xl text-sm text-muted-foreground">
          Sign in to post your own goals, comment, or react.
        </div>
      )}

      {/* Plain in-flow header, on the page's normal background -- shown
          below lg always, and at lg+ for Card View. In Tree View at lg+ this
          is replaced by the identical content overlaid directly on the tree
          art itself (passed into GoalsTreeView as `header`, using the same
          headingBlock/searchInput/toggleButtons so the two can't drift
          apart) -- hidden here rather than removed so mobile/tablet Tree
          View still gets a normal, readable header instead of cramming text
          onto a short image. */}
      <div className={cn("space-y-4", view === "tree" && "lg:hidden")}>
        {/* `relative` + the search wrapper's `sm:absolute sm:left-1/2
            sm:-translate-x-1/2` centers it against the row's TRUE full
            width, regardless of how wide the heading block ends up --
            `flex-1 justify-center` (the previous approach) only centered it
            within the space left over after the heading, which visibly
            drifted right of center once the heading's own width varied. */}
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start justify-between gap-3 shrink-0">
            {headingBlock()}
            <Button onClick={() => setIsDialogOpen(true)} disabled={!session} className="md:hidden shrink-0 hover-elevate">
              <Plus className="w-4 h-4 mr-2" /> Add Goals
            </Button>
          </div>
          <div className="w-full sm:w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2">{searchInput}</div>
        </div>
        {toggleButtons}
      </div>

      {sortedPeople.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No one matches "{search}".</div>
      ) : view === "tree" ? (
        // `-mx-4 md:-mx-8` cancels PageTransition's own padding so the tree
        // art reaches the true full width of <main> instead of leaving a
        // gutter of its own (both themes). `lg:-mt-8` additionally cancels
        // its top padding at lg+ so the overlaid header can start flush with
        // the very top of the page instead of leaving a strip of plain page
        // background above "Goals" -- below lg the header stays in normal
        // flow above this box (see above) so no top cancel is needed there.
        // `relative z-0` (needs the explicit z-0, not just relative -- a
        // stacking-context gotcha: `position: relative` alone doesn't
        // create one, so a plain z-index on a descendant can escape past
        // this wrapper to the document root) gives the detail panel a
        // positioning root to float over at lg+ (see TreeDetailPanel).
        <div className="relative z-0 -mx-4 md:-mx-8 lg:-mt-8 lg:-mb-8">
          <GoalsTreeView
            people={sortedPeople}
            goalsByOwner={goalsByOwner}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
            header={
              <div className="space-y-4">
                {/* Same true-center technique as the plain header above --
                    absolutely positioned at the row's real midpoint instead
                    of centered within whatever space the heading leaves
                    over, which drifted right of center. */}
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                  {headingBlock()}
                  <div className="w-full sm:w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2">{searchInput}</div>
                </div>
                {toggleButtons}
              </div>
            }
          />
          {selected && (
            <TreeDetailPanel
              person={selected}
              goals={goalsByOwner.get(selected.id) ?? []}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedPeople.map((p) => (
            <PersonGoalCard
              key={p.id}
              person={p}
              goals={goalsByOwner.get(p.id) ?? []}
              onClick={() => setSelected(p)}
            />
          ))}
        </div>
      )}

      <Dialog open={view === "card" && !!selected} onOpenChange={(o) => !o && setSelected(null)}>
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
    </>
  );
}

// A general "wall" for the person, separate from any one goal -- react or
// comment on them directly, the same way you'd leave something on their
// profile, rather than being tied to a specific goal.
// One card per person: name + a preview of their short/mid/long-term goal on
// the left, and a real comment/reaction "wall" for them on the right/bottom
// -- fully usable right there on the card, no need to open the dialog just
// to say something. The two areas that open the full "all their goals"
// dialog are separate buttons (avatar/name, and the goal list) so they
// don't end up nesting inside the wall's own interactive buttons/inputs.
function PersonGoalCard({
  person,
  goals,
  onClick,
}: {
  person: DirectoryProfile;
  goals: Goal[];
  onClick: () => void;
}) {
  const { session, isAdmin } = useAuth();
  const { data: comments = [] } = useComments("profile", person.id);
  const addComment = useAddComment("profile", person.id);
  const deleteComment = useDeleteComment("profile", person.id);
  const [commentText, setCommentText] = useState("");

  const latestByTerm = useMemo(() => {
    const map = new Map<GoalTerm, Goal>();
    for (const g of goals) {
      const existing = map.get(g.term);
      if (!existing || new Date(g.created_at) > new Date(existing.created_at)) {
        map.set(g.term, g);
      }
    }
    return map;
  }, [goals]);

  // useComments returns oldest-first (chat-log order) -- take the last few
  // and flip them for a newest-first preview.
  const recentComments = comments.slice(-2).reverse();

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate(commentText.trim(), { onSuccess: () => setCommentText("") });
  };

  return (
    <div className="flex flex-col bg-card border-2 border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
      <button onClick={onClick} className="flex items-center gap-2.5 min-w-0 mb-4 text-left hover:opacity-80 transition-opacity">
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className="w-11 h-11 shrink-0"
        />
        <div className="min-w-0">
          <div className="font-bold text-base truncate">@{person.username}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[person.role, person.department].filter(Boolean).join(" · ") || "No role"}
          </div>
        </div>
      </button>

      <div className="flex-1 flex gap-4 mb-3">
        <button onClick={onClick} className="flex-1 min-w-0 space-y-3 text-left hover:opacity-80 transition-opacity">
          {TERM_ORDER.slice().reverse().map((term) => {
            const goal = latestByTerm.get(term);
            const category = goal?.category ?? "personal";
            return (
              <div key={term}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">{GOAL_TERM_META[term].label}</span>
                  {goal && (
                    <span
                      className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                        category === "career" ? "bg-secondary/20 text-secondary" : "bg-primary/15 text-primary"
                      )}
                    >
                      {GOAL_CATEGORY_META[category].label}
                    </span>
                  )}
                  {goal && <span className="text-xs text-muted-foreground">: {goal.title}</span>}
                </div>
                {goal?.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{goal.description}</p>
                )}
                {goal?.accountability && (
                  <div className="flex items-start gap-1 text-[10px] text-muted-foreground bg-muted/30 rounded px-1.5 py-1 mt-1">
                    <ListChecks className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{goal.accountability}</span>
                  </div>
                )}
                {!goal && <p className="text-[11px] text-muted-foreground italic opacity-70">No goal set</p>}
              </div>
            );
          })}
        </button>

        <div className="w-2/5 shrink-0 border-l border-border/50 pl-4 flex flex-col">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2 shrink-0">
            <MessageCircle className="w-3.5 h-3.5" />
            Comments {comments.length > 0 && `(${comments.length})`}
          </div>
          <div className="flex-1 space-y-1.5 mb-2 overflow-hidden">
            {recentComments.length > 0 ? (
              recentComments.map((c) => (
                <div key={c.id} className="text-[11px] bg-muted/40 rounded-md px-2 py-1.5 flex items-start gap-1">
                  <p className="flex-1 min-w-0">
                    <span className="font-medium">@{c.author?.username ?? "?"}: </span>
                    <span className="text-muted-foreground line-clamp-2">{c.body}</span>
                  </p>
                  {(isAdmin || c.author_id === session?.user.id) && (
                    <button
                      type="button"
                      onClick={() => window.confirm("Delete this comment?") && deleteComment.mutate(c.id)}
                      disabled={deleteComment.isPending}
                      title="Delete comment"
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground italic opacity-70">No comments yet</p>
            )}
          </div>
          {session && (
            <form onSubmit={handleAddComment} className="flex gap-1.5 shrink-0">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Comment..."
                className="flex-1 min-w-0 h-7 rounded-full border border-input bg-background px-2.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || addComment.isPending}
                className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border/50">
        <ReactionBar targetType="profile" targetId={person.id} />
      </div>
    </div>
  );
}
