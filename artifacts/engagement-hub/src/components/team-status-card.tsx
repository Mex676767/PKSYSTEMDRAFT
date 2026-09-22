import { useState } from "react";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActivityHistoryDialog } from "@/components/activity-history-dialog";
import { useDirectory } from "@/hooks/use-mentors";
import { useAppPresenceMap } from "@/hooks/use-app-presence";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { VOICE_CHANNELS } from "@/lib/voice-channels";
import { PRESENCE_DOT_CLASS, PRESENCE_BADGE_CLASS, formatRelativeTime, type PresenceStatusColor } from "@/lib/presence";
import { cn } from "@/lib/utils";

function statusFor(
  userId: string,
  voiceChannelId: string | undefined,
  liveActivity: string | undefined,
  lastSeenAt: string | null
): { label: string; tooltip: string; color: PresenceStatusColor } {
  if (voiceChannelId) {
    const channel = VOICE_CHANNELS.find((c) => c.id === voiceChannelId);
    const category = channel?.category ?? "active";
    const label = category === "break" ? "On a Break" : category === "afk" ? "AFK" : "In Voice";
    const color: PresenceStatusColor =
      category === "training" ? "cyan" : category === "meeting" ? "violet" : category === "afk" ? "amber" : category === "break" ? "blue" : "green";
    return { label, tooltip: channel?.name ?? "In a voice channel", color };
  }
  if (liveActivity) {
    return { label: liveActivity, tooltip: liveActivity, color: "green" };
  }
  return { label: "Offline", tooltip: `Last seen ${formatRelativeTime(lastSeenAt)}`, color: "gray" };
}

export function TeamStatusCard() {
  const { data: directory = [] } = useDirectory();
  const presenceMap = useAppPresenceMap();
  const { occupants } = useVoiceCall();
  const [historyUser, setHistoryUser] = useState<{ id: string; username: string } | null>(null);

  const voiceChannelByUserId = new Map<string, string>();
  for (const [channelId, participants] of occupants) {
    for (const p of participants) voiceChannelByUserId.set(p.id, channelId);
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {directory.map((p) => {
              const status = statusFor(p.id, voiceChannelByUserId.get(p.id), presenceMap.get(p.id)?.activity, p.last_seen_at);
              return (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setHistoryUser({ id: p.id, username: p.username })}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                    >
                      <UserAvatar
                        user={{ name: p.username, initials: initialsForUsername(p.username), color: colorForId(p.id) }}
                        photoUrl={p.avatar_url}
                        border={p.active_border}
                        className="w-8 h-8 text-[10px] shrink-0"
                      />
                      <span className="text-xs font-medium truncate min-w-0">@{p.username}</span>
                      <span
                        className={cn(
                          "shrink-0 ml-auto inline-flex items-center gap-1.5 h-5 pl-2 pr-2.5 rounded-full whitespace-nowrap",
                          PRESENCE_BADGE_CLASS[status.color]
                        )}
                      >
                        <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", PRESENCE_DOT_CLASS[status.color])} />
                        <span className="text-[10px] font-medium">{status.label}</span>
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{status.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </CardContent>

      <ActivityHistoryDialog
        userId={historyUser?.id ?? null}
        username={historyUser?.username ?? ""}
        open={!!historyUser}
        onOpenChange={(open) => !open && setHistoryUser(null)}
      />
    </Card>
  );
}
