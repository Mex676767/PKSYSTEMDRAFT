import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActivityHistory } from "@/hooks/use-activity-history";
import { VOICE_CHANNELS } from "@/lib/voice-channels";
import { formatDuration } from "@/lib/presence";
import { Clock, Radio } from "lucide-react";

// Matches touch_presence(): a session without a heartbeat for this long is
// over, and the next heartbeat starts a new one.
const SESSION_STALE_MS = 2 * 60 * 1000;

function channelName(channelId: string) {
  return VOICE_CHANNELS.find((c) => c.id === channelId)?.name ?? channelId;
}

export function ActivityHistoryDialog({
  userId,
  username,
  open,
  onOpenChange,
}: {
  userId: string | null;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useActivityHistory(userId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>@{username}'s Activity</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-pulse w-6 h-6 rounded-full bg-primary/20" />
          </div>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" /> Recent sessions
              </h3>
              {!data?.logins.length ? (
                <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.logins.map((s) => {
                    const start = new Date(s.started_at);
                    const lastBeat = new Date(s.last_heartbeat_at);
                    // Closing the tab never sets ended_at, so an unended session
                    // is only still live if its heartbeat is recent; otherwise it
                    // ended at its last heartbeat.
                    const isOpen = !s.ended_at && Date.now() - lastBeat.getTime() < SESSION_STALE_MS;
                    const end = s.ended_at ? new Date(s.ended_at) : lastBeat;
                    const endedMs = isOpen ? Date.now() : end.getTime();
                    const sameDay = end.toDateString() === start.toDateString();
                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                        <span>
                          {start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          {" -> "}
                          {isOpen
                            ? "now"
                            : sameDay
                              ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                              : end.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground text-xs">{formatDuration(endedMs - start.getTime())}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                <Radio className="w-3.5 h-3.5" /> Voice channel history
              </h3>
              {!data?.voiceSessions.length ? (
                <p className="text-sm text-muted-foreground">No voice channel activity yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.voiceSessions.map((s) => {
                    const start = new Date(s.joined_at);
                    const end = s.left_at ? new Date(s.left_at) : null;
                    const durationMs = (end ? end.getTime() : Date.now()) - start.getTime();
                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                        <span className="truncate">{channelName(s.channel_id)}</span>
                        <span className="text-muted-foreground text-xs shrink-0 ml-2">
                          {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatDuration(durationMs)}
                          {!end && " (ongoing)"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
