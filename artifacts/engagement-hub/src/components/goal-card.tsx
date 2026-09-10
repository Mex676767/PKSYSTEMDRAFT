import { useState } from "react";
import { format, isPast } from "date-fns";
import { Circle, Clock, MessageCircle, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { useComments } from "@/hooks/use-social";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { GOAL_CATEGORY_META, type Goal } from "@/hooks/use-goals";
import { cn } from "@/lib/utils";

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
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("goal", goal.id);
  const style = TERM_STYLES[goal.term];
  const overdue = goal.target_date && !goal.completed && isPast(new Date(goal.target_date));

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
            </div>
            <h3 className="font-semibold text-lg truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{goal.description}</p>
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
    </Card>
  );
}
