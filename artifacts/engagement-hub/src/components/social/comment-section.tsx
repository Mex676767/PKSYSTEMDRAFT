import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useComments, useAddComment, type TargetType } from "@/hooks/use-social";
import { cn } from "@/lib/utils";

export function CommentSection({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
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
          <div className="flex-1 min-w-0 bg-muted/40 rounded-xl px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-xs">@{c.author?.username ?? "unknown"}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm break-words">{c.body}</p>
          </div>
        </div>
      ))}

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet — be the first.</p>
      )}

      {session && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 h-9 rounded-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={addComment.isPending || !text.trim()}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
