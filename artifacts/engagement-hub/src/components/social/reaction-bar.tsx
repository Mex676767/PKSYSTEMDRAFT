import { useAuth } from "@/hooks/use-auth";
import { useReactions, useToggleReaction, REACTION_EMOJIS, type TargetType } from "@/hooks/use-social";
import { cn } from "@/lib/utils";

export function ReactionBar({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
  const { session } = useAuth();
  const { data: reactions = [] } = useReactions(targetType, targetId);
  const toggle = useToggleReaction(targetType, targetId);

  const counts = REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => r.emoji === emoji && r.user_id === session?.user.id),
  }));

  return (
    <div className="flex gap-1.5 flex-wrap">
      {counts.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          onClick={() => toggle.mutate(emoji)}
          disabled={!session || toggle.isPending}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50",
            mine
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>{emoji}</span>
          {count > 0 && <span>{count}</span>}
        </button>
      ))}
    </div>
  );
}
