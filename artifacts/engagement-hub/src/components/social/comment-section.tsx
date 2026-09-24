import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, Reply, X } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment, useDeleteComment, type Comment, type TargetType } from "@/hooks/use-social";
import { cn, getErrorMessage } from "@/lib/utils";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage";

const commentDraftKey = (targetType: TargetType, targetId: string) => `c9myr:comment-draft:${targetType}:${targetId}`;

function CommentRow({
  comment,
  onDark,
  canDelete,
  onDelete,
  onReply,
  isReply,
}: {
  comment: Comment;
  onDark?: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onReply: () => void;
  isReply?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-2 text-sm", isReply && "ml-8")}>
      <UserAvatar
        user={{ name: comment.author?.username ?? "unknown", initials: initialsForUsername(comment.author?.username ?? "?"), color: colorForId(comment.author_id) }}
        photoUrl={comment.author?.avatar_url ?? null}
        border={comment.author?.active_border ?? null}
        accessory={comment.author?.active_accessory ?? null}
        className={cn("shrink-0", isReply ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]")}
      />
      <div className="flex-1 min-w-0">
        <div className={cn("rounded-xl px-3 py-2", onDark ? "bg-white/15" : "bg-muted/40")}>
          <div className="flex items-baseline gap-2">
            <span className={cn("font-semibold text-xs", onDark && "text-white")}>
              @{comment.author?.username ?? "unknown"}
            </span>
            <span className={cn("text-[10px]", onDark ? "text-white/70" : "text-muted-foreground")}>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {canDelete && (
              <button
                onClick={onDelete}
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
          <p className={cn("text-sm break-words", onDark && "text-white")}>{comment.body}</p>
        </div>
        <button
          onClick={onReply}
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium mt-1 ml-1 transition-colors",
            onDark ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Reply className="w-3 h-3" /> Reply
        </button>
      </div>
    </div>
  );
}

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
  const { data: comments = [], error: loadError, isLoading } = useComments(targetType, targetId);
  const addComment = useAddComment(targetType, targetId);
  const deleteComment = useDeleteComment(targetType, targetId);
  const [text, setText] = useState(() => loadDraft<string>(commentDraftKey(targetType, targetId)) ?? "");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(loadDraft<string>(commentDraftKey(targetType, targetId)) ?? "");
    setReplyingTo(null);
  }, [targetType, targetId]);

  useEffect(() => {
    if (text.trim()) saveDraft(commentDraftKey(targetType, targetId), text);
    else clearDraft(commentDraftKey(targetType, targetId));
  }, [text, targetType, targetId]);

  // Facebook-style flat threading: top-level comments each carry their own
  // list of replies, and replying to a reply still attaches to that same
  // top-level thread (no infinitely nested chains).
  const { topLevel, repliesByParent } = useMemo(() => {
    const topLevel: Comment[] = [];
    const repliesByParent = new Map<string, Comment[]>();
    for (const c of comments) {
      if (!c.parent_comment_id || !comments.some(parent => parent.id === c.parent_comment_id)) {
        topLevel.push(c);
      } else {
        if (!repliesByParent.has(c.parent_comment_id)) repliesByParent.set(c.parent_comment_id, []);
        repliesByParent.get(c.parent_comment_id)!.push(c);
      }
    }
    return { topLevel, repliesByParent };
  }, [comments]);

  const startReply = (threadId: string, username: string) => {
    addComment.reset();
    setReplyingTo({ id: threadId, username });
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || addComment.isPending) return;
    addComment.mutate(
      { body: text.trim(), parentCommentId: replyingTo?.id ?? null },
      {
        onSuccess: () => {
          setText("");
          setReplyingTo(null);
          clearDraft(commentDraftKey(targetType, targetId));
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      {topLevel.map((c) => (
        <div key={c.id} className="space-y-2">
          <CommentRow
            comment={c}
            onDark={onDark}
            canDelete={isAdmin || c.author_id === session?.user.id}
            onDelete={() => window.confirm("Delete this comment?") && deleteComment.mutate(c.id)}
            onReply={() => startReply(c.id, c.author?.username ?? "unknown")}
          />
          {(repliesByParent.get(c.id) ?? []).map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              onDark={onDark}
              isReply
              canDelete={isAdmin || r.author_id === session?.user.id}
              onDelete={() => window.confirm("Delete this reply?") && deleteComment.mutate(r.id)}
              onReply={() => startReply(c.id, r.author?.username ?? "unknown")}
            />
          ))}
        </div>
      ))}

      {isLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
      {(loadError || addComment.error || deleteComment.error) && <p role="alert" className={cn("text-xs", onDark ? "text-red-200" : "text-destructive")}>{getErrorMessage(loadError ?? addComment.error ?? deleteComment.error)}</p>}
      {!isLoading && !loadError && comments.length === 0 && (
        <p className={cn("text-xs", onDark ? "text-white/70" : "text-muted-foreground")}>
          No comments yet — be the first.
        </p>
      )}

      {session && (
        <form onSubmit={handleSubmit} className="space-y-1.5">
          {replyingTo && (
            <div className={cn("flex items-center gap-1.5 text-[11px] pl-1", onDark ? "text-white/80" : "text-muted-foreground")}>
              Replying to <span className="font-semibold">@{replyingTo.username}</span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className={cn("transition-colors", onDark ? "hover:text-white" : "hover:text-foreground")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              disabled={addComment.isPending}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : "Add a comment..."}
              className={cn(
                "flex-1 h-9 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                onDark
                  ? "bg-white/10 border-white/25 text-white placeholder:text-white/60"
                  : "bg-background border-input"
              )}
            />
            <button
              type="submit"
              aria-label={addComment.isPending ? "Sending comment" : replyingTo ? "Send reply" : "Send comment"}
              disabled={addComment.isPending || !text.trim()}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50",
                onDark ? "bg-white text-neutral-900" : "bg-primary text-primary-foreground"
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
