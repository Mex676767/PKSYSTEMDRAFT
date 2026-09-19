import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceChannels } from "@/hooks/use-voice-channel";
import { VOICE_CHANNEL_IDS } from "@/lib/voice-channels";

type VoiceCallState = ReturnType<typeof useVoiceChannels>;

const VoiceCallContext = createContext<VoiceCallState | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin } = useAuth();
  const state = useVoiceChannels(
    VOICE_CHANNEL_IDS,
    isAdmin ? profile?.id : undefined,
    isAdmin ? profile?.username ?? undefined : undefined
  );

  return <VoiceCallContext.Provider value={state}>{children}</VoiceCallContext.Provider>;
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within a VoiceCallProvider");
  return ctx;
}
