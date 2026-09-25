import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import type { DirectoryProfile } from "@/hooks/use-mentors";
import type { Profile } from "@/hooks/use-auth";
import type { VoiceParticipant } from "@/hooks/use-voice-channel";
import { MicOff, VolumeX, ScreenShare } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  participant: VoiceParticipant;
  isMe: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  myProfile: Profile | null;
  directoryEntry: DirectoryProfile | undefined;
  size?: "sm" | "md";
  connectionState?: RTCPeerConnectionState;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
};

export function VoiceParticipantAvatar({
  participant,
  isMe,
  isSpeaking,
  isMuted,
  isDeafened,
  myProfile,
  directoryEntry,
  size = "md",
  connectionState,
  volume,
  onVolumeChange,
}: Props) {
  const dimClass = size === "sm" ? "w-9 h-9" : "w-12 h-12";
  const deafened = isMe ? isDeafened : participant.deafened;
  const muted = isMe ? isMuted : participant.muted;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "relative rounded-full transition-shadow",
          isSpeaking && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card"
        )}
      >
        <UserAvatar
          user={{ name: participant.username, initials: initialsForUsername(participant.username), color: colorForId(participant.id) }}
          photoUrl={isMe ? myProfile?.avatar_url : directoryEntry?.avatar_url}
          border={isMe ? myProfile?.active_border : directoryEntry?.active_border}
          accessory={isMe ? myProfile?.active_accessory : directoryEntry?.active_accessory}
          className={dimClass}
        />
        {(deafened || muted) && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center">
            {deafened ? <VolumeX className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </span>
        )}
        {participant.streaming && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <ScreenShare className="w-3 h-3" />
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground truncate max-w-full">
        {isMe ? "You" : `@${participant.username}`}
      </span>
      {!isMe && connectionState && connectionState !== "connected" && (
        <span className="text-[9px] text-amber-500 truncate max-w-full -mt-1">
          {connectionState === "connecting" || connectionState === "new" ? "Connecting…" : "Connection issue"}
        </span>
      )}
      {!isMe && onVolumeChange && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume ?? 1}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-16 h-1 accent-primary"
          title={`Volume: ${Math.round((volume ?? 1) * 100)}%`}
        />
      )}
    </div>
  );
}

