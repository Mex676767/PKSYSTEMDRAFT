import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { DiscordStatusDot } from "@/components/discord-status-dot";
import { useDirectory } from "@/hooks/use-mentors";
import { useDiscordPresenceMap } from "@/hooks/use-discord";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { discordStatusLabel } from "@/lib/discord";

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
                  <div className="relative shrink-0">
                    <UserAvatar
                      user={{ name: p.username, initials: initialsForUsername(p.username), color: colorForId(p.id) }}
                      photoUrl={p.avatar_url}
                      border={p.active_border}
                      className="w-8 h-8 text-[10px]"
                    />
                    <DiscordStatusDot presence={presence} className="w-2.5 h-2.5 absolute bottom-0 right-0" />
                  </div>
                  <span className="text-xs font-medium truncate">@{p.username}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center flex-wrap gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/50">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" /> Break</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-400" /> Online</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-400/50" /> Offline</span>
        </div>
      </CardContent>
    </Card>
  );
}
