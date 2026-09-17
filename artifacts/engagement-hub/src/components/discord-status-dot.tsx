import { discordDotColor, discordStatusLabel, DISCORD_DOT_CLASS, type DiscordPresence } from "@/lib/discord";
import { cn } from "@/lib/utils";

export function DiscordStatusDot({
  presence,
  className,
}: {
  presence: DiscordPresence | null | undefined;
  className?: string;
}) {
  const color = discordDotColor(presence);
  return (
    <span
      title={discordStatusLabel(presence)}
      className={cn(
        "block rounded-full border-2 border-background",
        DISCORD_DOT_CLASS[color],
        className ?? "w-3 h-3"
      )}
    />
  );
}
