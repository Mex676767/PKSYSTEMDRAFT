import { useAuth } from "@/hooks/use-auth";
import { useReactions, useToggleReaction, REACTION_EMOJIS, type TargetType } from "@/hooks/use-social";
import { cn } from "@/lib/utils";

export function ReactionBar({
  targetType,
  targetId,
  onDark,
}: {
  targetType: TargetType;
  targetId: string;
  /**
   * Set this when the bar sits on a fixed, vividly-colored surface (e.g. the
   * pink birthday highlight, a photo) rather than the normal page/card
   * background -- that's a fixed-color contrast problem, independent of the
   * light/dark theme toggle, so it needs its own always-light styling
   * instead of the theme-aware muted/primary tokens.
   */
  onDark?: boolean;
}) {
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
            onDark
              ? mine
                ? "bg-white/25 border-white/50 text-white"
                : "bg-white/10 border-white/25 text-white/90 hover:bg-white/20"
              : mine
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
