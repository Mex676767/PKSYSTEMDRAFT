import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, Mic, MicOff, PhoneOff, VolumeX, X, ChevronUp, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { useAuth } from "@/hooks/use-auth";
import { useDirectory } from "@/hooks/use-mentors";
import { VoiceParticipantAvatar } from "@/components/voice-participant-avatar";
import { VOICE_CHANNELS, VOICE_CATEGORY_DOT } from "@/lib/voice-channels";
import { DISCORD_DOT_CLASS } from "@/lib/discord";
import { cn } from "@/lib/utils";

export function FloatingCallBar() {
  const [location] = useLocation();
  const { profile } = useAuth();
  const { channelId, participants, speakingIds, muted, deafened, leave, toggleMute, toggleDeafen } = useVoiceCall();
  const { data: directory = [] } = useDirectory({ refetchInterval: 15000 });
  const directoryById = new Map(directory.map((p) => [p.id, p]));
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (channelId) setMinimized(false);
  }, [channelId]);

  if (!channelId || location === "/voice") return null;

  const channel = VOICE_CHANNELS.find((c) => c.id === channelId);
  if (!channel) return null;

  return (
    <AnimatePresence>
      {minimized ? (
        <motion.button
          key="minimized"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => setMinimized(false)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-card/90 backdrop-blur-xl border border-primary/40 rounded-full shadow-lg pl-3 pr-4 py-2 hover:border-primary/70 transition-colors"
        >
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-medium">{channel.name}</span>
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.button>
      ) : (
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-5 right-5 z-40 w-72 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border/60">
            <span className={cn("w-2 h-2 rounded-full shrink-0", DISCORD_DOT_CLASS[VOICE_CATEGORY_DOT[channel.category]])} />
            <Link href="/voice" className="text-sm font-semibold truncate hover:underline">
              {channel.name}
            </Link>
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{participants.length} in call</span>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Minimize"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {participants.map((p) => (
              <VoiceParticipantAvatar
                key={p.id}
                participant={p}
                isMe={p.id === profile?.id}
                isSpeaking={speakingIds.has(p.id)}
                isMuted={muted}
                myProfile={profile}
                directoryEntry={directoryById.get(p.id)}
                size="sm"
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 px-3 pb-3">
            <Button
              size="icon"
              variant={muted ? "destructive" : "outline"}
              className="rounded-full w-9 h-9"
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant={deafened ? "destructive" : "outline"}
              className="rounded-full w-9 h-9"
              onClick={toggleDeafen}
              title={deafened ? "Undeafen" : "Deafen"}
            >
              {deafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="destructive" className="rounded-full w-9 h-9" onClick={leave} title="Leave">
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
