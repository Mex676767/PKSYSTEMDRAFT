import { useState } from "react";
import { differenceInCalendarDays, format, formatDistanceToNow, isPast } from "date-fns";
import {
  Clock,
  Plus,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  ClipboardList,
  Trash2,
  Pencil,
  History,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { Confetti } from "@/components/confetti";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { ProgressPhotos } from "@/components/progress-photos";
import { useComments } from "@/hooks/use-social";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  GOAL_TERM_META,
  GOAL_CATEGORY_META,
  computeTargetDate,
  useDeleteGoal,
  useUpdateGoal,
  useGoalUpdates,
  useGoalUpdateStats,
  useAddGoalUpdate,
  useDeleteGoalUpdate,
  type Goal,
  type GoalTerm,
  type GoalCategory,
} from "@/hooks/use-goals";
import { getErrorMessage, cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/searchable-select";

const TERM_ORDER: GoalTerm[] = ["short", "mid", "long"];
const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

const TERM_STYLES: Record<Goal["term"], { text: string; dot: string; button: string }> = {
  long: { text: "text-accent", dot: "bg-accent shadow-[0_0_10px_hsl(var(--accent))]", button: "text-accent border-accent/50 bg-accent/10 hover:bg-accent/20" },
  mid: { text: "text-secondary", dot: "bg-secondary shadow-[0_0_10px_hsl(var(--secondary))]", button: "text-secondary border-secondary/50 bg-secondary/10 hover:bg-secondary/20" },
  short: { text: "text-primary", dot: "bg-primary shadow-[0_0_10px_hsl(var(--primary))]", button: "text-primary border-primary/50 bg-primary/10 hover:bg-primary/20" },
};

export function GoalCard({
  goal,
  isOwner,
}: {
  goal: Goal;
  isOwner: boolean;
}) {
  const { isAdmin } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const { data: comments = [] } = useComments("goal", goal.id);
  const { data: updates = [] } = useGoalUpdates(showUpdates ? goal.id : null);
  const deleteGoal = useDeleteGoal();
  const deleteUpdate = useDeleteGoalUpdate();
  const updateGoal = useUpdateGoal();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoggingUpdate, setIsLoggingUpdate] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const style = TERM_STYLES[goal.term];
  const { data: stats } = useGoalUpdateStats(goal.id);
  const overdue = goal.target_date && !goal.completed && isPast(new Date(goal.target_date));
  const daysLeft = goal.target_date && !goal.completed ? differenceInCalendarDays(new Date(goal.target_date), new Date()) : null;
  const canDelete = isOwner || isAdmin;
  const canLog = isOwner && !goal.completed;

  return (
    <Card className="shadow-sm hover:shadow-md transition-all overflow-hidden p-0">
      <Confetti active={showConfetti} />
      <CardContent className="p-0">
        <div className="px-4 md:px-5 pt-4 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
          <span className={cn("font-display font-bold text-[10px] tracking-[0.12em] uppercase", style.text)}>{GOAL_TERM_META[goal.term].label}</span>
          <span aria-hidden>·</span>
          <UserAvatar
            user={{ name: goal.owner?.username ?? "unknown", initials: initialsForUsername(goal.owner?.username ?? "?"), color: colorForId(goal.owner_id) }}
            photoUrl={goal.owner?.avatar_url ?? null}
            border={goal.owner?.active_border ?? null}
            accessory={goal.owner?.active_accessory ?? null}
            className="w-5 h-5 text-[9px]"
          />
          <span className="min-w-0 truncate">
            @{goal.owner?.username ?? "unknown"}
            {goal.owner?.role && ` · ${goal.owner.role}`}
            {` · ${GOAL_CATEGORY_META[goal.category ?? "personal"].label.replace(" Goal", "")}`}
          </span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
            {goal.completed && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Completed</Badge>}
            {isOwner && (
              <button onClick={() => setIsEditing(true)} title="Edit goal" className="hover:text-primary transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => window.confirm("Delete this goal?") && deleteGoal.mutate(goal.id)}
                disabled={deleteGoal.isPending}
                title="Delete goal"
                className="hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 md:px-5 pt-2.5 pb-4 space-y-3">
          <div>
            <h3 className="font-display font-bold text-xl leading-tight break-words">{goal.title}</h3>
            {goal.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-1">{goal.description}</p>}
          </div>

          <div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full min-w-3 transition-[width] duration-500", goal.completed ? "bg-emerald-500" : "bg-gradient-flame shadow-glow-primary")}
                style={{ width: `${goal.progress}%` }}
              />
              <div className="absolute inset-0 flex justify-evenly pointer-events-none" aria-hidden>
                <span className="w-px bg-border" /><span className="w-px bg-border" /><span className="w-px bg-border" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1.5 text-xs text-muted-foreground">
              <span><b className="font-display text-lg text-foreground">{goal.progress}%</b> done</span>
              <span className={cn("flex items-center gap-1", overdue && "text-destructive")}>
                <Clock className="w-3 h-3" />
                {goal.target_date
                  ? `${format(new Date(goal.target_date), "MMM d, yyyy")}${daysLeft !== null ? ` · ${daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : `${-daysLeft} day${daysLeft === -1 ? "" : "s"} over`}` : ""}`
                  : "No target date"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Updates" value={stats ? String(stats.count) : "–"} />
            <Stat label="Last update" value={stats?.last ? formatDistanceToNow(new Date(stats.last), { addSuffix: true }).replace("about ", "") : "Never"} />
            <Stat label="Started" value={format(new Date(goal.created_at), "MMM yyyy")} />
          </div>

          {goal.accountability && (
            <div className="flex items-start gap-2 text-xs rounded-xl bg-muted/50 px-3 py-2">
              <ListChecks className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", style.text)} />
              <span><span className="font-semibold">If I miss it:</span> <span className="text-muted-foreground">{goal.accountability}</span></span>
            </div>
          )}
          {goal.action_plan && (
            <details className="group rounded-xl bg-muted/40 px-3 py-2" open={!goal.accountability}>
              <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><ClipboardList className={cn("w-3.5 h-3.5", style.text)} /> The plan</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-2">{goal.action_plan}</p>
            </details>
          )}

          <ProgressPhotos targetType="goal" targetId={goal.id} canUpload={isOwner} />
        </div>

        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap px-4 md:px-5 py-3 bg-background/40 border-t border-border/60">
          <ReactionBar targetType="goal" targetId={goal.id} />
          <button
            onClick={() => setShowUpdates((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="w-4 h-4" />
            Updates
            {showUpdates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comment"}
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {canLog && (
            <button
              onClick={() => setIsLoggingUpdate(true)}
              className={cn("ml-auto flex items-center gap-1 text-xs font-semibold rounded-full border px-3 py-1.5 transition-colors", style.button)}
            >
              <Plus className="w-3.5 h-3.5" /> Log progress
            </button>
          )}
        </div>

        <div className={cn("px-4 md:px-5", (showUpdates || showComments) && "pb-4 pt-3 space-y-3")}>
        {showUpdates && (
          <div className="pt-1 space-y-2">
            {updates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No progress updates logged yet.</p>
            ) : (
              updates.map((u) => (
                <div key={u.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg px-2.5 py-2">
                  <UserAvatar
                    user={{ name: u.author?.username ?? "unknown", initials: initialsForUsername(u.author?.username ?? "?"), color: colorForId(u.author_id) }}
                    photoUrl={u.author?.avatar_url ?? null}
                    border={u.author?.active_border ?? null}
                    accessory={u.author?.active_accessory ?? null}
                    className="w-5 h-5 text-[8px] shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">@{u.author?.username ?? "unknown"}</span>
                      <span className="text-muted-foreground">moved progress to {u.progress}%</span>
                      <span className="text-muted-foreground/70">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
                    </p>
                    {u.note && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{u.note}</p>}
                  </div>
                  {(u.author_id === goal.owner_id ? isOwner : false) || isAdmin ? (
                    <button
                      onClick={() => window.confirm("Delete this update?") && deleteUpdate.mutate({ id: u.id, goalId: goal.id })}
                      disabled={deleteUpdate.isPending}
                      title="Delete update"
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {showComments && (
          <div className="pt-1">
            <CommentSection targetType="goal" targetId={goal.id} />
          </div>
        )}
        </div>
      </CardContent>

      {isOwner && (
        <>
          <EditGoalDialog goal={goal} open={isEditing} onOpenChange={setIsEditing} updateGoal={updateGoal} />
          <LogUpdateDialog
            goal={goal}
            open={isLoggingUpdate}
            onOpenChange={setIsLoggingUpdate}
            onCompleted={() => {
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 5000);
            }}
          />
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2.5 py-2 min-w-0">
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
      <p className="font-display font-semibold text-sm truncate">{value}</p>
    </div>
  );
}

function LogUpdateDialog({
  goal,
  open,
  onOpenChange,
  onCompleted,
}: {
  goal: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const addUpdate = useAddGoalUpdate();
  const [progress, setProgress] = useState(goal.progress);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const willComplete = progress >= 100 && !goal.completed;
    addUpdate.mutate(
      { goalId: goal.id, progress, completed: progress >= 100, note },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNote("");
          if (willComplete) onCompleted();
        },
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setProgress(goal.progress);
          setNote("");
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Progress Update</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you do, and what's the next step?"
            autoFocus
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={addUpdate.isPending}>
            {addUpdate.isPending ? "Saving..." : "Post Update"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditGoalDialog({
  goal,
  open,
  onOpenChange,
  updateGoal,
}: {
  goal: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateGoal: ReturnType<typeof useUpdateGoal>;
}) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [term, setTerm] = useState<GoalTerm>(goal.term);
  const [category, setCategory] = useState<GoalCategory>(goal.category ?? "personal");
  const [accountability, setAccountability] = useState(goal.accountability ?? "");
  const [actionPlan, setActionPlan] = useState(goal.action_plan ?? "");
  const [targetDate, setTargetDate] = useState<string | null>(goal.target_date ? goal.target_date.slice(0, 10) : null);
  const [error, setError] = useState<string | null>(null);

  const resetFromGoal = () => {
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setTerm(goal.term);
    setCategory(goal.category ?? "personal");
    setAccountability(goal.accountability ?? "");
    setActionPlan(goal.action_plan ?? "");
    setTargetDate(goal.target_date ? goal.target_date.slice(0, 10) : null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (term === "short" && !accountability.trim()) {
      setError("Short-term goals need a follow-through plan.");
      return;
    }
    setError(null);

    updateGoal.mutate(
      {
        id: goal.id,
        updates: {
          title: title.trim(),
          description: description.trim(),
          term,
          category,
          accountability: term === "short" ? accountability.trim() : null,
          action_plan: actionPlan.trim() || null,
          target_date: targetDate,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) resetFromGoal(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <SearchableSelect
              value={category}
              onValueChange={(v) => setCategory(v as GoalCategory)}
              options={CATEGORY_ORDER.map((c) => ({ value: c, label: GOAL_CATEGORY_META[c].label }))}
              searchable={false}
              aria-label="Category"
              className="h-9 w-auto min-w-[8rem]"
            />
            <SearchableSelect
              value={term}
              onValueChange={(v) => setTerm(v as GoalTerm)}
              options={TERM_ORDER.map((t) => ({ value: t, label: GOAL_TERM_META[t].label }))}
              searchable={false}
              aria-label="Term"
              className="h-9 w-auto min-w-[8rem]"
            />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details..."
            className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Action Plan (optional)
            </label>
            <textarea
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="How are you going to get there? List the steps..."
              className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {term === "short" && (
            <textarea
              value={accountability}
              onChange={(e) => setAccountability(e.target.value)}
              placeholder="Follow-through plan: what will help you keep moving on this?"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target Date (optional)</label>
            <div className="flex items-center gap-2">
              <DatePicker value={targetDate} onChange={setTargetDate} className="flex-1" />
              {targetDate && (
                <Button type="button" variant="outline" size="sm" onClick={() => setTargetDate(null)} title="Clear target date">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              {!targetDate && (
                <Button type="button" variant="outline" size="sm" onClick={() => setTargetDate(computeTargetDate(term).slice(0, 10))}>
                  Suggest
                </Button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={updateGoal.isPending}>
            {updateGoal.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
