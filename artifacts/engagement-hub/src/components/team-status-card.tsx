import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { DiscordStatusDot } from "@/components/discord-status-dot";
import { useDirectory } from "@/hooks/use-mentors";
import { useDiscordPresenceMap } from "@/hooks/use-discord";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { discordStatusLabel, discordShortStatusLabel, discordDotColor, DISCORD_BADGE_CLASS } from "@/lib/discord";
import { cn } from "@/lib/utils";

export function TeamStatusCard() {
  const { data: directory = [] } = useDirectory();
  const { data: presenceMap } = useDiscordPresenceMap();

  return (
    <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/10 via-card to-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" /> Team Status
        </CardTitle>
        <CardDescription>Who's around right now</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {directory.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3 text-center bg-muted/50 rounded-lg">
            No teammates yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {directory.map((p) => {
              const presence = presenceMap?.get(p.id);
              return (
                <div
                  key={p.id}
                  title={discordStatusLabel(presence)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/40"
                >
                  <UserAvatar
                    user={{ name: p.username, initials: initialsForUsername(p.username), color: colorForId(p.id) }}
                    photoUrl={p.avatar_url}
                    border={p.active_border}
                    className="w-8 h-8 text-[10px] shrink-0"
                  />
                  <span className="text-xs font-medium truncate flex-1 min-w-0">@{p.username}</span>
                  <span
                    className={cn(
                      "relative shrink-0 ml-auto w-28 h-5 rounded-full",
                      DISCORD_BADGE_CLASS[discordDotColor(presence)]
                    )}
                  >
                    <DiscordStatusDot
                      presence={presence}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-0"
                    />
                    <span className="absolute inset-0 flex items-center justify-center px-1 text-[10px] font-medium truncate">
                      {discordShortStatusLabel(presence)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
