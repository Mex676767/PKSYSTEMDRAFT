import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { Headphones, Mic, MicOff, PhoneOff, Radio, Sparkles, Users, VolumeX } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useVoiceChannels } from "@/hooks/use-voice-channel";
import { useDirectory } from "@/hooks/use-mentors";
import { DISCORD_BADGE_CLASS, DISCORD_DOT_CLASS, type DiscordCategory, type DiscordDotColor } from "@/lib/discord";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";

type Channel = {
  id: string;
  name: string;
  category: DiscordCategory;
};

const CHANNELS: Channel[] = [
  { id: "general", name: "General", category: "active" },
  { id: "designer", name: "Designer", category: "active" },
  { id: "data-analysis", name: "Data Analysis", category: "active" },
  { id: "marketing", name: "Marketing", category: "active" },
  { id: "retention", name: "Retention - T1 & T2", category: "active" },
  { id: "vip-retention", name: "VIP Retention - Tier 3 & V", category: "active" },
  { id: "training", name: "Training Room", category: "training" },
  { id: "meeting-1", name: "Meeting Room 1", category: "meeting" },
  { id: "meeting-2", name: "Meeting Room 2", category: "meeting" },
  { id: "meeting-3", name: "Meeting Room 3", category: "meeting" },
  { id: "afk", name: "AFK", category: "afk" },
  { id: "lunch-break", name: "Lunch Break/Dinner Break", category: "break" },
];

const CATEGORY_DOT: Record<DiscordCategory, DiscordDotColor> = {
  active: "green",
  training: "cyan",
  meeting: "violet",
  afk: "amber",
  break: "blue",
};

const CHANNEL_IDS = CHANNELS.map((c) => c.id);

export default function Voice() {
  const { profile, isAdmin } = useAuth();
  const { occupants, channelId, participants, speakingIds, muted, deafened, connecting, error, join, leave, toggleMute, toggleDeafen } = useVoiceChannels(
    CHANNEL_IDS,
    profile?.id,
    profile?.username ?? undefined
  );
  const { data: directory = [] } = useDirectory({ refetchInterval: 15000 });
  const directoryById = new Map(directory.map((p) => [p.id, p]));
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!isAdmin) return <NotFound />;

  const joined = CHANNELS.find((c) => c.id === channelId) ?? null;

  const handleJoin = async (targetId: string) => {
    setPendingId(targetId);
    if (channelId) leave();
    await join(targetId);
    setPendingId(null);
  };

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="w-8 h-8 text-primary" /> Voice Channels
          </h1>
          <p className="text-muted-foreground mt-1">Talk to your team without leaving the app.</p>
        </div>
        <Badge variant="outline" className="shrink-0 flex items-center gap-1.5 border-primary/40 text-primary bg-primary/10">
          <Sparkles className="w-3 h-3" /> Early Preview -- Admins Only
        </Badge>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error} Check your browser's microphone permissions for this site.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {CHANNELS.map((channel) => {
            const isJoined = channelId === channel.id;
            const isPending = pendingId === channel.id && connecting;
            const dot = CATEGORY_DOT[channel.category];
            const channelOccupants = isJoined ? participants : occupants.get(channel.id) ?? [];
            return (
              <motion.div key={channel.id} variants={slideUp}>
                <Card className={cn("shadow-sm transition-colors", isJoined && "border-primary/50 bg-primary/5")}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", DISCORD_DOT_CLASS[dot])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{channel.name}</p>
                      {channelOccupants.length > 0 ? (
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {channelOccupants.map((p) => p.username).join(", ")}
                        </span>
                      ) : (
                        <span className={cn("inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", DISCORD_BADGE_CLASS[dot])}>
                          Empty
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isJoined ? "secondary" : "outline"}
                      className="shrink-0 h-8"
                      disabled={isPending}
                      onClick={() => (isJoined ? leave() : handleJoin(channel.id))}
                    >
                      {isPending ? "Joining..." : isJoined ? "Joined" : "Join"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <Card className="shadow-sm lg:sticky lg:top-24">
          <CardContent className="p-5">
            {!joined ? (
              <div className="py-12 flex flex-col items-center text-center text-muted-foreground gap-2">
                <Users className="w-8 h-8 opacity-40" />
                <p className="text-sm">Join a channel to start talking.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", DISCORD_DOT_CLASS[CATEGORY_DOT[joined.category]])} />
                  <h2 className="font-semibold text-sm">{joined.name}</h2>
                  <Badge variant="outline" className="ml-auto text-[10px]">{participants.length} in call</Badge>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {participants.map((p) => {
                    const isMe = p.id === profile?.id;
                    const isSpeaking = speakingIds.has(p.id);
                    const dirEntry = directoryById.get(p.id);
                    return (
                      <div key={p.id} className="flex flex-col items-center gap-1.5">
                        <div
                          className={cn(
                            "relative rounded-full transition-shadow",
                            isSpeaking && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card"
                          )}
                        >
                          <UserAvatar
                            user={{ name: p.username, initials: initialsForUsername(p.username), color: colorForId(p.id) }}
                            photoUrl={isMe ? profile?.avatar_url : dirEntry?.avatar_url}
                            border={isMe ? profile?.active_border : dirEntry?.active_border}
                            className="w-12 h-12"
                          />
                          {isMe && muted && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center">
                              <MicOff className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-full">
                          {isMe ? "You" : `@${p.username}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-2 pt-3 border-t border-border/50">
                  <Button
                    size="icon"
                    variant={muted ? "destructive" : "outline"}
                    className="rounded-full"
                    onClick={toggleMute}
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant={deafened ? "destructive" : "outline"}
                    className="rounded-full"
                    onClick={toggleDeafen}
                    title={deafened ? "Undeafen" : "Deafen"}
                  >
                    {deafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="destructive" className="rounded-full" onClick={leave} title="Leave">
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Headphones className="w-3.5 h-3.5" /> Real peer-to-peer voice -- your mic audio only leaves your browser when you join a channel.
      </p>
    </PageTransition>
  );
}
