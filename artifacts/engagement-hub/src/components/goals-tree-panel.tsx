import { useState } from "react";
import { X, ListChecks, Send, Leaf, Sprout, TreeDeciduous, ChevronDown, Trash2, Pencil } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment, useDeleteComment } from "@/hooks/use-social";
import { GOAL_TERM_META, GOAL_CATEGORY_META, useDeleteGoal, useUpdateGoal, type Goal, type GoalTerm } from "@/hooks/use-goals";
import { EditGoalDialog } from "@/components/goal-card";
import { titleLabel } from "@/lib/titles";
import type { DirectoryProfile } from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";

const TERM_ORDER: GoalTerm[] = ["short", "mid", "long"];

const TERM_ICON: Record<GoalTerm, { Icon: typeof Leaf; badge: string }> = {
  short: { Icon: Leaf, badge: "bg-emerald-500/15 text-emerald-500" },
  mid: { Icon: Sprout, badge: "bg-amber-500/15 text-amber-500" },
  long: { Icon: TreeDeciduous, badge: "bg-teal-500/15 text-teal-500" },
};

type Tab = "goals" | "progress" | "comments";

function personCompletion(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

export function TreeDetailPanel(
  {
    person,
    goals,
    onClose,
  }: {
    person: DirectoryProfile;
    goals: Goal[];
    onClose: () => void;
  }
) {
  const { session, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("goals");
  const [expandedTerm, setExpandedTerm] = useState<GoalTerm | null>(null);
  const { data: comments = [] } = useComments("profile", person.id);
  const addComment = useAddComment("profile", person.id);
  const deleteComment = useDeleteComment("profile", person.id);
  const [commentText, setCommentText] = useState("");
  const completion = personCompletion(goals);
  const totalCompleted = goals.filter((g) => g.completed).length;
  const isOwner = session?.user.id === person.id;
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const position = [person.role, person.department].filter(Boolean).join(" - ") || "No team";
  const badgeLabel = person.active_title ? titleLabel(person.active_title) : null;

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate(commentText.trim(), { onSuccess: () => setCommentText("") });
  };

  return (
    <div
      className={cn(
        "mt-4 lg:mt-0 lg:absolute lg:top-24 lg:right-6 lg:z-40 lg:max-h-[calc(100%-7rem)]",
        "w-full lg:w-80 shrink-0 bg-card/85 backdrop-blur-xl backdrop-saturate-150",
        "rounded-2xl shadow-xl shadow-black/20 ring-1 ring-white/40 dark:ring-white/10",
        "overflow-hidden flex flex-col max-h-[480px]"
      )}
    >
      <div className="p-4 flex items-start gap-3 border-b border-border">
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className="w-14 h-14 border-2 border-white shadow shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">@{person.username}</p>
          <p className="text-xs text-muted-foreground truncate">{position}</p>
          {badgeLabel && (
            <span
              className={cn(
                "inline-block mt-1.5 text-[10px] font-bold text-white rounded-full px-2 py-0.5",
                colorForId(person.id)
              )}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        <button onClick={onClose} title="Close" className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 pb-0 grid grid-cols-2 gap-2 shrink-0">
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
          <div className="text-lg font-bold">{completion}%</div>
          <div className="text-[10px] text-muted-foreground">Completion</div>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
          <div className="text-lg font-bold">
            {totalCompleted}/{goals.length}
          </div>
          <div className="text-[10px] text-muted-foreground">Goals</div>
        </div>
      </div>

      <div className="flex border-b border-border shrink-0 mt-3">
        {(["goals", "progress", "comments"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-xs font-semibold capitalize transition-colors border-b-2",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {tab === "goals" &&
          (goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No goals posted yet.</p>
          ) : (
            <>
              {TERM_ORDER.map((term) => {
                const termGoals = goals.filter((g) => g.term === term);
                const termCompleted = termGoals.filter((g) => g.completed).length;
                const { Icon, badge } = TERM_ICON[term];
                const isOpen = expandedTerm === term;
                return (
                  <div key={term} className="rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedTerm(isOpen ? null : term)}
                      disabled={termGoals.length === 0}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 disabled:opacity-50"
                    >
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", badge)}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-semibold flex-1 text-left">{GOAL_TERM_META[term].label} Goals</span>
                      <span className="text-xs text-muted-foreground">
                        {termCompleted}/{termGoals.length}
                      </span>
                      {termGoals.length > 0 && (
                        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-2.5">
                        {termGoals.map((goal) => (
                          <div key={goal.id} className="rounded-lg bg-muted/30 p-2.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                                  goal.category === "career" ? "bg-secondary/20 text-secondary" : "bg-primary/15 text-primary"
                                )}
                              >
                                {GOAL_CATEGORY_META[goal.category].label}
                              </span>
                              <span className="text-xs font-medium flex-1 min-w-0">{goal.title}</span>
                              {isOwner && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setEditingGoal(goal)}
                                    title="Edit goal"
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.confirm("Delete this goal?") && deleteGoal.mutate(goal.id)}
                                    disabled={deleteGoal.isPending}
                                    title="Delete goal"
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {goal.description && <p className="text-[11px] text-muted-foreground">{goal.description}</p>}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all progress-shimmer"
                                  style={{ width: `${goal.progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{goal.progress}%</span>
                            </div>
                            {goal.accountability && (
                              <div className="flex items-start gap-1 text-[10px] text-muted-foreground bg-muted/30 rounded px-1.5 py-1">
                                <ListChecks className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{goal.accountability}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-[11px] text-muted-foreground italic text-center pt-1">
                "Small steps every day lead to big results."
              </p>
            </>
          ))}

        {tab === "progress" && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="text-4xl font-bold text-primary">{completion}%</div>
              <p className="text-xs text-muted-foreground mt-1">Overall goal completion</p>
            </div>
            {TERM_ORDER.map((term) => {
              const termGoals = goals.filter((g) => g.term === term);
              const avg = termGoals.length
                ? Math.round(termGoals.reduce((sum, g) => sum + g.progress, 0) / termGoals.length)
                : 0;
              return (
                <div key={term} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{GOAL_TERM_META[term].label}</span>
                    <span className="text-muted-foreground">{termGoals.length ? `${avg}%` : "No goals"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all progress-shimmer" style={{ width: `${avg}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "comments" &&
          (comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-xs bg-muted/40 rounded-md px-2.5 py-2 flex items-start gap-1.5">
                  <p className="flex-1 min-w-0">
                    <span className="font-medium">@{c.author?.username ?? "?"}: </span>
                    <span className="text-muted-foreground">{c.body}</span>
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
              ))}
            </div>
          ))}
      </div>

      {tab === "comments" && session && (
        <form onSubmit={handleAddComment} className="flex gap-1.5 p-3 border-t border-border shrink-0">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Comment..."
            className="flex-1 min-w-0 h-8 rounded-full border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || addComment.isPending}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {editingGoal && (
        <EditGoalDialog
          goal={editingGoal}
          open={!!editingGoal}
          onOpenChange={(o) => !o && setEditingGoal(null)}
          updateGoal={updateGoal}
        />
      )}
    </div>
  );
}
