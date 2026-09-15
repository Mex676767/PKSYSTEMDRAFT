import { useState } from "react";
import { format, isPast } from "date-fns";
import { Circle, Clock, MessageCircle, ChevronDown, ChevronUp, ListChecks, Trash2, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onAdvance,
  updating,
}: {
  goal: Goal;
  isOwner: boolean;
  onAdvance: () => void;
  updating: boolean;
}) {
  const { isAdmin } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("goal", goal.id);
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();
  const [isEditing, setIsEditing] = useState(false);
  const style = TERM_STYLES[goal.term];
  const overdue = goal.target_date && !goal.completed && isPast(new Date(goal.target_date));
  const canDelete = isOwner || isAdmin;

  return (
    <Card className={cn("border-l-4 shadow-sm hover:shadow-md transition-all bg-gradient-to-r to-card", style.border, style.from)}>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <button
            onClick={onAdvance}
            disabled={!isOwner || updating || goal.completed}
            className={cn(
              "shrink-0 transition-colors focus:outline-none disabled:opacity-40 hover:scale-110 transition-transform",
              style.text
            )}
            title={isOwner ? "Mark progress" : "Only the owner can update this goal"}
          >
            <Circle className={cn("w-8 h-8 stroke-2", goal.completed && "fill-emerald-500 text-emerald-500")} />
          </button>

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="w-5 h-5">
                <AvatarFallback className={cn("text-white text-[9px] font-bold", colorForId(goal.owner_id))}>
                  {initialsForUsername(goal.owner?.username ?? "?")}
                </AvatarFallback>
              </Avatar>
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
          <button
            onClick={() => setShowComments((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comment"}
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showComments && (
          <div className="pt-1">
            <CommentSection targetType="goal" targetId={goal.id} />
          </div>
        )}
      </CardContent>

      {isOwner && (
        <EditGoalDialog goal={goal} open={isEditing} onOpenChange={setIsEditing} updateGoal={updateGoal} />
      )}
    </Card>
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
  const [error, setError] = useState<string | null>(null);

  // Re-sync from the goal whenever the dialog is (re)opened, in case it was
  // edited elsewhere (or reopened on a different goal instance) since last time.
  const resetFromGoal = () => {
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setTerm(goal.term);
    setCategory(goal.category ?? "personal");
    setAccountability(goal.accountability ?? "");
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

    const termChanged = term !== goal.term;
    updateGoal.mutate(
      {
        id: goal.id,
        updates: {
          title: title.trim(),
          description: description.trim(),
          term,
          category,
          accountability: term === "short" ? accountability.trim() : null,
          ...(termChanged ? { target_date: computeTargetDate(term) } : {}),
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
          {term === "short" && (
            <textarea
              value={accountability}
              onChange={(e) => setAccountability(e.target.value)}
              placeholder="Accountability action -- what will you actually do to hold yourself to this?"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={updateGoal.isPending}>
            {updateGoal.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
