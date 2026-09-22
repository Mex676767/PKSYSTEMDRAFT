import { useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  Circle,
  Clock,
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
import { Progress } from "@/components/ui/progress";
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
  useAddGoalUpdate,
  useDeleteGoalUpdate,
  type Goal,
  type GoalTerm,
  type GoalCategory,
} from "@/hooks/use-goals";
import { getErrorMessage, cn } from "@/lib/utils";

const TERM_ORDER: GoalTerm[] = ["short", "mid", "long"];
const CATEGORY_ORDER: GoalCategory[] = ["personal", "career"];

const TERM_STYLES: Record<Goal["term"], { border: string; from: string; text: string }> = {
  long: { border: "border-l-accent", from: "from-accent/15", text: "text-accent" },
  mid: { border: "border-l-secondary", from: "from-secondary/10", text: "text-secondary" },
  short: { border: "border-l-primary", from: "from-primary/10", text: "text-primary" },
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
  const overdue = goal.target_date && !goal.completed && isPast(new Date(goal.target_date));
  const canDelete = isOwner || isAdmin;

  return (
    <Card className={cn("border-l-4 shadow-sm hover:shadow-md transition-all bg-gradient-to-r to-card", style.border, style.from)}>
      <Confetti active={showConfetti} />
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <button
            onClick={() => setIsLoggingUpdate(true)}
            disabled={!isOwner || goal.completed}
            className={cn(
              "shrink-0 transition-colors focus:outline-none disabled:opacity-40 hover:scale-110 transition-transform",
              style.text
            )}
            title={isOwner ? "Log a progress update" : "Only the owner can update this goal"}
          >
            <Circle className={cn("w-8 h-8 stroke-2", goal.completed && "fill-emerald-500 text-emerald-500")} />
          </button>

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <UserAvatar
                user={{ name: goal.owner?.username ?? "unknown", initials: initialsForUsername(goal.owner?.username ?? "?"), color: colorForId(goal.owner_id) }}
                photoUrl={goal.owner?.avatar_url ?? null}
                border={goal.owner?.active_border ?? null}
                className="w-5 h-5 text-[9px]"
              />
              <span className="text-xs text-muted-foreground">@{goal.owner?.username ?? "unknown"}</span>
              {goal.owner?.role && <Badge variant="outline" className="text-[9px]">{goal.owner.role}</Badge>}
              <Badge variant="outline" className="text-[9px]">{GOAL_CATEGORY_META[goal.category ?? "personal"].label}</Badge>
              {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
              {goal.completed && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Completed</Badge>}
              {(isOwner || canDelete) && (
                <div className="ml-auto flex items-center gap-2.5 shrink-0">
                  {isOwner && (
                    <button
                      onClick={() => setIsEditing(true)}
                      title="Edit goal"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => window.confirm("Delete this goal?") && deleteGoal.mutate(goal.id)}
                      disabled={deleteGoal.isPending}
                      title="Delete goal"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <h3 className="font-semibold text-lg break-words">{goal.title}</h3>
            {goal.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{goal.description}</p>
            )}
            {goal.accountability && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 mt-1.5">
                <ListChecks className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{goal.accountability}</span>
              </div>
            )}
            {goal.action_plan && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 mt-1.5">
                <ClipboardList className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{goal.action_plan}</span>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1 font-medium text-muted-foreground">
                  <span>Progress</span>
                  <span>{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </div>
              {goal.target_date && (
                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(new Date(goal.target_date), "MMM d, yyyy")}
                </div>
              )}
            </div>

            <ProgressPhotos targetType="goal" targetId={goal.id} canUpload={isOwner} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border/50 -mx-4 md:-mx-6 px-4 md:px-6 pt-3">
          <ReactionBar targetType="goal" targetId={goal.id} />
          <div className="flex items-center gap-3">
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
          </div>
        </div>

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
      setError("Short-term goals need an accountability action.");
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{GOAL_CATEGORY_META[c].label}</option>
              ))}
            </select>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value as GoalTerm)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {TERM_ORDER.map((t) => (
                <option key={t} value={t}>{GOAL_TERM_META[t].label}</option>
              ))}
            </select>
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
              placeholder="Accountability action -- what will you actually do to hold yourself to this?"
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
