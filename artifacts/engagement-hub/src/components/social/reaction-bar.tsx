import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useAuth } from "@/hooks/use-auth";
import {
  useReactions,
  useToggleReaction,
  EMOJI_PICKER_OPTIONS,
  type TargetType,
} from "@/hooks/use-social";
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
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group into one pill per emoji actually used, in first-used order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, typeof reactions>();
    for (const r of reactions) {
      if (!map.has(r.emoji)) {
        map.set(r.emoji, []);
        order.push(r.emoji);
      }
      map.get(r.emoji)!.push(r);
    }
    return order.map((emoji) => ({ emoji, users: map.get(emoji)! }));
  }, [reactions]);

  const pillClass = (mine: boolean) =>
    cn(
      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
      !session && "cursor-not-allowed",
      toggle.isPending && "opacity-50",
      onDark
        ? mine
          ? "bg-white/25 border-white/50 text-white"
          : "bg-white/15 border-white/35 text-white hover:bg-white/25"
        : mine
          ? "bg-primary/15 border-primary/40 text-primary"
          : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
    );

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {groups.map(({ emoji, users }) => {
        const mine = users.some((u) => u.user_id === session?.user.id);
        return (
          <HoverCard key={emoji} openDelay={150} closeDelay={0}>
            <HoverCardTrigger asChild>
              <button
                onClick={() => toggle.mutate(emoji)}
                disabled={!session || toggle.isPending}
                className={pillClass(mine)}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              align="start"
              className="w-auto max-w-xs p-2 text-[11px] whitespace-nowrap"
            >
              {users.map((u) => `@${u.user?.username ?? "unknown"}`).join(", ")}
            </HoverCardContent>
          </HoverCard>
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={!session}
            title="Add a reaction"
            className={cn(
              "w-6 h-6 rounded-full border border-dashed flex items-center justify-center shrink-0 transition-colors",
              !session && "cursor-not-allowed opacity-40",
              onDark ? "border-white/40 text-white/80 hover:bg-white/15" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          className="w-64 max-h-48 overflow-y-auto p-2 grid grid-cols-8 gap-0.5"
        >
          {EMOJI_PICKER_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                toggle.mutate(emoji);
                setPickerOpen(false);
              }}
              className="text-base leading-none p-1.5 rounded hover:bg-muted transition-colors"
            >
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
