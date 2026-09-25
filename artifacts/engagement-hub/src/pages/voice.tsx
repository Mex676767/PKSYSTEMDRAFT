import { ScreenShareTile } from "@/components/screen-share-tile";
import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Headphones, Mic, MicOff, PhoneOff, Radio, ScreenShare, ScreenShareOff, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { useDirectory } from "@/hooks/use-mentors";
import { VoiceParticipantAvatar } from "@/components/voice-participant-avatar";
import { VOICE_CHANNELS, VOICE_CATEGORY_DOT, VOICE_CATEGORY_BADGE_CLASS, VOICE_CATEGORY_DOT_CLASS } from "@/lib/voice-channels";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";

export default function Voice() {
  const { profile, isAdmin } = useAuth();
  const {
    occupants,
    channelId,
    participants,
    speakingIds,
    connectionStates,
    muted,
    deafened,
    connecting,
    error,
    volumes,
    setParticipantVolume,
    isStreaming,
    localScreenStream,
    startingScreenShare,
    remoteVideoStreams,
    startScreenShare,
    stopScreenShare,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    audioBlocked,
    unlockAudio,
  } = useVoiceCall();
  const { data: directory = [] } = useDirectory({ refetchInterval: 15000 });
  const directoryById = new Map(directory.map((p) => [p.id, p]));
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!isAdmin) return <NotFound />;

  const joined = VOICE_CHANNELS.find((c) => c.id === channelId) ?? null;

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
          <Sparkles className="w-3 h-3" /> Early Preview · Admins Only
        </Badge>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {audioBlocked && (
        <button
          onClick={unlockAudio}
          className="w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2 font-medium hover:bg-amber-500/20 transition-colors animate-pulse"
        >
          <Volume2 className="w-4 h-4" /> Tap here to enable audio. Your browser is blocking playback.
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {VOICE_CHANNELS.map((channel) => {
            const isJoined = channelId === channel.id;
            const isPending = pendingId === channel.id && connecting;
            // Block every OTHER channel's button too while a join is still in
            // flight -- clicking a different channel mid-connect used to be
            // able to join both at once.
            const blockedByOtherJoin = connecting && pendingId !== null && pendingId !== channel.id;
            const dot = VOICE_CATEGORY_DOT[channel.category];
            const channelOccupants = isJoined ? participants : occupants.get(channel.id) ?? [];
            return (
              <motion.div key={channel.id} variants={slideUp}>
                <Card className={cn("shadow-sm transition-colors", isJoined && "border-primary/50 bg-primary/5")}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", VOICE_CATEGORY_DOT_CLASS[dot])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{channel.name}</p>
                      {channelOccupants.length > 0 ? (
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {channelOccupants.map((p) => p.username).join(", ")}
                        </span>
                      ) : (
                        <span className={cn("inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", VOICE_CATEGORY_BADGE_CLASS[dot])}>
                          Empty
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isJoined ? "secondary" : "outline"}
                      className="shrink-0 h-8"
                      disabled={isPending || blockedByOtherJoin}
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
                  <span className={cn("w-2 h-2 rounded-full", VOICE_CATEGORY_DOT_CLASS[VOICE_CATEGORY_DOT[joined.category]])} />
                  <h2 className="font-semibold text-sm">{joined.name}</h2>
                  <Badge variant="outline" className="ml-auto text-[10px]">{participants.length} in call</Badge>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {participants.map((p) => {
                    const isMe = p.id === profile?.id;
                    return (
                      <VoiceParticipantAvatar
                        key={p.id}
                        participant={p}
                        isMe={isMe}
                        isSpeaking={speakingIds.has(p.id)}
                        isMuted={muted}
                        isDeafened={deafened}
                        myProfile={profile}
                        directoryEntry={directoryById.get(p.id)}
                        connectionState={connectionStates.get(p.id)}
                        volume={isMe ? undefined : volumes.get(p.id)}
                        onVolumeChange={isMe ? undefined : (v) => setParticipantVolume(p.id, v)}
                      />
                    );
                  })}
                </div>

                {(localScreenStream || remoteVideoStreams.size > 0) && (
                  <div className="grid grid-cols-1 gap-3 pt-3 border-t border-border/50">
                    {localScreenStream && <ScreenShareTile stream={localScreenStream} label="Your screen (preview)" onStop={stopScreenShare} />}
                    {Array.from(remoteVideoStreams.entries()).filter(([id]) => participants.some(p => p.id === id && p.streaming)).map(([peerId, stream]) => <ScreenShareTile key={peerId} stream={stream} label={`@${participants.find(p => p.id === peerId)?.username ?? "Someone"}'s screen`} />)}
                    <p className="text-xs text-muted-foreground">Screen video only. Your microphone follows the call's mute control.</p>
                  </div>
                )}

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
                  <Button
                    size="icon"
                    variant={isStreaming ? "destructive" : "outline"}
                    className="rounded-full"
                    disabled={startingScreenShare}
                    aria-label={isStreaming ? "Stop sharing" : startingScreenShare ? "Choosing screen" : "Share your screen"}
                    onClick={isStreaming ? stopScreenShare : startScreenShare}
                    title={isStreaming ? "Stop sharing" : "Share your screen"}
                  >
                    {isStreaming ? <ScreenShareOff className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
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
    </PageTransition>
  );
}
