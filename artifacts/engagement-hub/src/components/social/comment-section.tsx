import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment, type TargetType } from "@/hooks/use-social";
import { cn } from "@/lib/utils";

export function CommentSection({
  targetType,
  targetId,
  onDark,
}: {
  targetType: TargetType;
  targetId: string;
  /**
   * Set this when the section sits on a fixed, vividly-colored surface
   * (e.g. the pink birthday highlight, a photo) rather than the normal
   * page/card background -- see the matching prop on ReactionBar.
   */
  onDark?: boolean;
}) {
  const { session } = useAuth();
  const { data: comments = [] } = useComments(targetType, targetId);
  const addComment = useAddComment(targetType, targetId);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment.mutate(text.trim(), { onSuccess: () => setText("") });
  };

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className={cn("text-white text-[10px] font-bold", colorForId(c.author_id))}>
              {initialsForUsername(c.author?.username ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className={cn("flex-1 min-w-0 rounded-xl px-3 py-2", onDark ? "bg-white/15" : "bg-muted/40")}>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-semibold text-xs", onDark && "text-white")}>
                @{c.author?.username ?? "unknown"}
              </span>
              <span className={cn("text-[10px]", onDark ? "text-white/70" : "text-muted-foreground")}>
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
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
