import { useState } from "react";
import { X, ListChecks, Send } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment } from "@/hooks/use-social";
import { GOAL_TERM_META, GOAL_CATEGORY_META, type Goal, type GoalTerm } from "@/hooks/use-goals";
import type { DirectoryProfile } from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";

// Mirrors the ordering in pages/goals.tsx -- kept local rather than shared
// since it's a small display-order constant, not real app state.
const TERM_ORDER: GoalTerm[] = ["long", "mid", "short"];

type Tab = "goals" | "progress" | "comments";

function personCompletion(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

// The right-side panel that opens when someone is picked on the tree --
// replaces the old "open a goals dialog" click behavior for Tree View, with
// Goals / Progress / Comments tabs matching the reference layout. Card View
// keeps the plain dialog (pages/goals.tsx gates which one renders).
export function TreeDetailPanel({
  person,
  goals,
  onClose,
}: {
  person: DirectoryProfile;
  goals: Goal[];
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("goals");
  const { data: comments = [] } = useComments("profile", person.id);
  const addComment = useAddComment("profile", person.id);
  const [commentText, setCommentText] = useState("");
  const completion = personCompletion(goals);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate(commentText.trim(), { onSuccess: () => setCommentText("") });
  };

  return (
    <div className="w-full lg:w-80 shrink-0 bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[640px]">
      <div className="p-4 flex items-start gap-3 border-b border-border">
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className="w-14 h-14 border-2 border-white shadow shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">@{person.username}</p>
          <p className="text-xs text-muted-foreground truncate">{person.role ?? "No role"}</p>
          <span
            className={cn(
              "inline-block mt-1.5 text-[10px] font-bold text-white rounded-full px-2 py-0.5",
              colorForId(person.id)
            )}
          >
            {completion}% complete
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-border shrink-0">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "goals" &&
          (goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No goals posted yet.</p>
          ) : (
            TERM_ORDER.map((term) => {
              const termGoals = goals.filter((g) => g.term === term);
              if (termGoals.length === 0) return null;
              return (
                <div key={term} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {GOAL_TERM_META[term].label}
                  </h4>
                  {termGoals.map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-border p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                            goal.category === "career" ? "bg-secondary/20 text-secondary" : "bg-primary/15 text-primary"
                          )}
                        >
                          {GOAL_CATEGORY_META[goal.category].label}
                        </span>
                        <span className="text-xs font-medium">{goal.title}</span>
                      </div>
                      {goal.description && <p className="text-[11px] text-muted-foreground">{goal.description}</p>}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
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
              );
            })
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
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avg}%` }} />
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
                <div key={c.id} className="text-xs bg-muted/40 rounded-md px-2.5 py-2">
                  <span className="font-medium">@{c.author?.username ?? "?"}: </span>
                  <span className="text-muted-foreground">{c.body}</span>
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
    </div>
  );
}
