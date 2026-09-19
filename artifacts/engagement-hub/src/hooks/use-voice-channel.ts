import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playVoiceCue } from "@/lib/voice-sfx";
import { getIceServers } from "@/lib/turn-credentials";

type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to: string; candidate: RTCIceCandidateInit };

export type VoiceParticipant = { id: string; username: string; muted: boolean; deafened: boolean };

const LAST_CHANNEL_KEY = "voice:lastChannel";

function readPresence(channel: RealtimeChannel): VoiceParticipant[] {
  const state = channel.presenceState() as Record<string, { username: string; muted?: boolean; deafened?: boolean }[]>;
  return Object.entries(state).map(([id, presences]) => ({
    id,
    username: presences[0]?.username ?? "unknown",
    muted: presences[0]?.muted ?? false,
    deafened: presences[0]?.deafened ?? false,
  }));
}

export function useVoiceChannels(channelIds: string[], userId: string | undefined, username: string | undefined) {
  const [occupants, setOccupants] = useState<Map<string, VoiceParticipant[]>>(new Map());
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map());
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const joinedIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingPlaybackRef = useRef<Set<string>>(new Set());
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]);
  const deafenedRef = useRef(false);
  const mutedRef = useRef(false);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const activeChannel = useCallback(() => {
    const id = joinedIdRef.current;
    return id ? channelsRef.current.get(id) ?? null : null;
  }, []);

  const sendSignal = useCallback(
    (payload: SignalPayload) => {
      activeChannel()?.send({ type: "broadcast", event: "signal", payload });
    },
    [activeChannel]
  );

  const attachAnalyser = useCallback((id: string, stream: MediaStream) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analysersRef.current.set(id, { analyser, data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) });
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    const el = audioElsRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
    }
    audioElsRef.current.delete(peerId);
    analysersRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    pendingPlaybackRef.current.delete(peerId);
    const timer = disconnectTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimersRef.current.delete(peerId);
    }
    setConnectionStates((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(peerId);
    if (!queue || queue.length === 0) return;
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore a stray bad candidate, the connection can still succeed with the rest
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      localStreamRef.current?.getTracks().forEach((track) => {
        if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
      });
      pc.onicecandidate = (e) => {
        if (e.candidate && userId) {
          console.log(`[voice] local ICE candidate for ${peerId}:`, e.candidate.type, e.candidate.candidate);
          sendSignal({ type: "candidate", from: userId, to: peerId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        console.log(`[voice] ontrack fired for ${peerId} -- remote media arrived`);
        const stream = e.streams[0];
        let el = audioElsRef.current.get(peerId);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.muted = deafenedRef.current;
          document.body.appendChild(el);
          audioElsRef.current.set(peerId, el);
        }
        el.srcObject = stream;
        el.play()
          .then(() => console.log(`[voice] audio playback started for ${peerId}`))
          .catch((err) => {
            console.warn(`[voice] audio playback BLOCKED for ${peerId}, will retry on next click`, err);
            pendingPlaybackRef.current.add(peerId);
          });
        attachAnalyser(peerId, stream);
      };
      pc.oniceconnectionstatechange = () => {
        console.log(`[voice] ICE connection state for ${peerId}: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
        console.log(`[voice] connection state for ${peerId}: ${pc.connectionState}`);
        setConnectionStates((prev) => {
          const next = new Map(prev);
          next.set(peerId, pc.connectionState);
          return next;
        });

        const existingTimer = disconnectTimersRef.current.get(peerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimersRef.current.delete(peerId);
        }

        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          cleanupPeer(peerId);
        } else if (pc.connectionState === "disconnected") {
          // "disconnected" is often transient (a brief network hiccup) and can
          // recover on its own, especially across real networks -- give it a
          // grace period instead of tearing the connection down immediately.
          const timer = setTimeout(() => {
            if (pcsRef.current.get(peerId)?.connectionState === "disconnected") {
              console.log(`[voice] ${peerId} still disconnected after grace period, cleaning up`);
              cleanupPeer(peerId);
            }
          }, 8000);
          disconnectTimersRef.current.set(peerId, timer);
        }
      };
      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [userId, sendSignal, attachAnalyser, cleanupPeer]
  );

  const initiateCall = useCallback(
    async (peerId: string) => {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (userId) sendSignal({ type: "offer", from: userId, to: peerId, sdp: offer });
    },
    [createPeerConnection, sendSignal, userId]
  );

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!userId || payload.to !== userId || joinedIdRef.current === null) return;
      if (payload.type === "offer") {
        const pc = pcsRef.current.get(payload.from) ?? createPeerConnection(payload.from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingCandidates(payload.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", from: userId, to: payload.from, sdp: answer });
      } else if (payload.type === "answer") {
        const pc = pcsRef.current.get(payload.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingCandidates(payload.from, pc);
        }
      } else if (payload.type === "candidate") {
        const pc = pcsRef.current.get(payload.from);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {
            // ignore
          }
        } else {
          const queue = pendingCandidatesRef.current.get(payload.from) ?? [];
          queue.push(payload.candidate);
          pendingCandidatesRef.current.set(payload.from, queue);
        }
      }
    },
    [userId, createPeerConnection, sendSignal, flushPendingCandidates]
  );

  // Keep a lightweight presence-only subscription open for every channel, for the
  // entire time this page is mounted, so the channel list shows who's live in each
  // one -- independent of whether the current user has actually joined any of them.
  useEffect(() => {
    if (!userId) return;
    for (const id of channelIds) {
      if (channelsRef.current.has(id)) continue;
      const channel = supabase.channel(`voice:${id}`, { config: { presence: { key: userId } } });
      channel.on("presence", { event: "sync" }, () => {
        const list = readPresence(channel);
        setOccupants((prev) => {
          const next = new Map(prev);
          next.set(id, list);
          return next;
        });
        if (joinedIdRef.current === id) {
          setParticipants(list);
          for (const p of list) {
            if (p.id === userId) continue;
            if (!pcsRef.current.has(p.id) && userId < p.id) initiateCall(p.id);
          }
        }
      });
      channel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        if (joinedIdRef.current === id) cleanupPeer(key);
      });
      channel.on("broadcast", { event: "signal" }, ({ payload }: { payload: SignalPayload }) => {
        if (channelsRef.current.get(id) === channel) void handleSignal(payload);
      });
      channel.subscribe();
      channelsRef.current.set(id, channel);
    }

    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelIds.join("|"), userId]);

  const join = useCallback(
    async (targetId: string) => {
      if (!userId || !username) return;
      const channel = channelsRef.current.get(targetId);
      if (!channel) return;
      setError(null);
      setConnecting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        attachAnalyser(userId, stream);
        iceServersRef.current = await getIceServers();
        console.log("[voice] ICE servers for this call:", iceServersRef.current);

        joinedIdRef.current = targetId;
        mutedRef.current = false;
        await channel.track({ username, muted: false, deafened: false });
        setParticipants(readPresence(channel));
        setJoinedId(targetId);
        try {
          sessionStorage.setItem(LAST_CHANNEL_KEY, targetId);
        } catch {
          // ignore -- sessionStorage may be unavailable (private mode, etc.)
        }
        playVoiceCue("join");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't access your microphone.");
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        joinedIdRef.current = null;
      } finally {
        setConnecting(false);
      }
    },
    [userId, username, attachAnalyser]
  );

  const leave = useCallback(() => {
    const wasConnected = joinedIdRef.current !== null;
    const channel = joinedIdRef.current ? channelsRef.current.get(joinedIdRef.current) : null;
    for (const peerId of Array.from(pcsRef.current.keys())) cleanupPeer(peerId);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    channel?.untrack();
    joinedIdRef.current = null;
    try {
      sessionStorage.removeItem(LAST_CHANNEL_KEY);
    } catch {
      // ignore
    }
    setJoinedId(null);
    setParticipants([]);
    setSpeakingIds(new Set());
    setMuted(false);
    setDeafened(false);
    deafenedRef.current = false;
    mutedRef.current = false;
    if (wasConnected) playVoiceCue("leave");
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      if (username) activeChannel()?.track({ username, muted: next, deafened: deafenedRef.current });
      playVoiceCue(next ? "mute" : "unmute");
      return next;
    });
  }, [activeChannel, username]);

  const toggleDeafen = useCallback(() => {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    audioElsRef.current.forEach((el) => {
      el.muted = next;
    });
    playVoiceCue(next ? "deafen" : "undeafen");
    if (next) {
      setMuted(true);
      mutedRef.current = true;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    if (username) activeChannel()?.track({ username, muted: mutedRef.current, deafened: next });
  }, [activeChannel, username]);

  // A real page reload (not a tab switch, which no longer tears anything down)
  // destroys the live call along with everything else in memory -- there's no
  // way around that. What we CAN do is remember which channel was joined and
  // rejoin it automatically as soon as the channel subscriptions are ready.
  useEffect(() => {
    if (!userId || !username || joinedIdRef.current) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(LAST_CHANNEL_KEY);
    } catch {
      saved = null;
    }
    if (saved && channelsRef.current.has(saved)) {
      join(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username]);

  useEffect(() => {
    if (!joinedId) return;
    const tick = () => {
      const speaking = new Set<string>();
      analysersRef.current.forEach(({ analyser, data }, id) => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        if (avg > 12) speaking.add(id);
      });
      setSpeakingIds(speaking);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [joinedId]);

  // Mobile browsers can silently block autoplay on an <audio> element created
  // asynchronously in pc.ontrack, even after the join button's own click. Retry
  // playback on the next real user gesture so the connection isn't left mute.
  useEffect(() => {
    if (!joinedId) return;
    const retryBlockedPlayback = () => {
      if (pendingPlaybackRef.current.size === 0) return;
      for (const peerId of Array.from(pendingPlaybackRef.current)) {
        const el = audioElsRef.current.get(peerId);
        if (!el) {
          pendingPlaybackRef.current.delete(peerId);
          continue;
        }
        el.play()
          .then(() => pendingPlaybackRef.current.delete(peerId))
          .catch(() => {});
      }
    };
    document.addEventListener("click", retryBlockedPlayback);
    document.addEventListener("touchend", retryBlockedPlayback);
    return () => {
      document.removeEventListener("click", retryBlockedPlayback);
      document.removeEventListener("touchend", retryBlockedPlayback);
    };
  }, [joinedId]);

  useEffect(() => {
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    occupants,
    channelId: joinedId,
    participants,
    speakingIds,
    connectionStates,
    muted,
    deafened,
    connecting,
    error,
    join,
    leave,
    toggleMute,
    toggleDeafen,
  };
}
