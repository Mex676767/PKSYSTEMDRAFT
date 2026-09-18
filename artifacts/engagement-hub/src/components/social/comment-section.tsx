import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment, useDeleteComment, type TargetType } from "@/hooks/use-social";
import { cn } from "@/lib/utils";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage";

const commentDraftKey = (targetType: TargetType, targetId: string) => `c9myr:comment-draft:${targetType}:${targetId}`;

export function CommentSection({
  targetType,
  targetId,
  onDark,
}: {
  targetType: TargetType;
  targetId: string;
  onDark?: boolean
}) {
  const { session, isAdmin } = useAuth();
  const { data: comments = [] } = useComments(targetType, targetId);
  const addComment = useAddComment(targetType, targetId);
  const deleteComment = useDeleteComment(targetType, targetId);
  const [text, setText] = useState(() => loadDraft<string>(commentDraftKey(targetType, targetId)) ?? "");

  useEffect(() => {
    setText(loadDraft<string>(commentDraftKey(targetType, targetId)) ?? "");
  }, [targetType, targetId]);

  useEffect(() => {
    if (text.trim()) saveDraft(commentDraftKey(targetType, targetId), text);
    else clearDraft(commentDraftKey(targetType, targetId));
  }, [text, targetType, targetId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment.mutate(text.trim(), {
      onSuccess: () => {
        setText("");
        clearDraft(commentDraftKey(targetType, targetId));
      },
    });
  };

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          <UserAvatar
            user={{ name: c.author?.username ?? "unknown", initials: initialsForUsername(c.author?.username ?? "?"), color: colorForId(c.author_id) }}
            photoUrl={c.author?.avatar_url ?? null}
            border={c.author?.active_border ?? null}
            className="w-7 h-7 text-[10px] shrink-0"
          />
          <div className={cn("flex-1 min-w-0 rounded-xl px-3 py-2", onDark ? "bg-white/15" : "bg-muted/40")}>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-semibold text-xs", onDark && "text-white")}>
                @{c.author?.username ?? "unknown"}
              </span>
              <span className={cn("text-[10px]", onDark ? "text-white/70" : "text-muted-foreground")}>
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
              {(isAdmin || c.author_id === session?.user.id) && (
                <button
                  onClick={() => window.confirm("Delete this comment?") && deleteComment.mutate(c.id)}
                  disabled={deleteComment.isPending}
                  title="Delete comment"
                  className={cn(
                    "ml-auto shrink-0 transition-colors",
                    onDark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-destructive"
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className={cn("text-sm break-words", onDark && "text-white")}>{c.body}</p>
          </div>
        </div>
      ))}

      {comments.length === 0 && (
        <p className={cn("text-xs", onDark ? "text-white/70" : "text-muted-foreground")}>
          No comments yet — be the first.
        </p>
      )}

      {session && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className={cn(
              "flex-1 h-9 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              onDark
                ? "bg-white/10 border-white/25 text-white placeholder:text-white/60"
                : "bg-background border-input"
            )}
          />
          <button
            type="submit"
            disabled={addComment.isPending || !text.trim()}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50",
              onDark ? "bg-white text-neutral-900" : "bg-primary text-primary-foreground"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
