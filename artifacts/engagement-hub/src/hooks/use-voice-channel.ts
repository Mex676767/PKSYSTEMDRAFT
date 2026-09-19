import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playVoiceCue } from "@/lib/voice-sfx";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to: string; candidate: RTCIceCandidateInit };

export type VoiceParticipant = { id: string; username: string };

function readPresence(channel: RealtimeChannel): VoiceParticipant[] {
  const state = channel.presenceState() as Record<string, { username: string }[]>;
  return Object.entries(state).map(([id, presences]) => ({
    id,
    username: presences[0]?.username ?? "unknown",
  }));
}

export function useVoiceChannels(channelIds: string[], userId: string | undefined, username: string | undefined) {
  const [occupants, setOccupants] = useState<Map<string, VoiceParticipant[]>>(new Map());
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
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
  const deafenedRef = useRef(false);
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
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current?.getTracks().forEach((track) => {
        if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
      });
      pc.onicecandidate = (e) => {
        if (e.candidate && userId) {
          sendSignal({ type: "candidate", from: userId, to: peerId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
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
        attachAnalyser(peerId, stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          cleanupPeer(peerId);
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

        joinedIdRef.current = targetId;
        await channel.track({ username });
        setParticipants(readPresence(channel));
        setJoinedId(targetId);
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
    setJoinedId(null);
    setParticipants([]);
    setSpeakingIds(new Set());
    setMuted(false);
    setDeafened(false);
    deafenedRef.current = false;
    if (wasConnected) playVoiceCue("leave");
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      playVoiceCue(next ? "mute" : "unmute");
      return next;
    });
  }, []);

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
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }, []);

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

  useEffect(() => {
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    occupants,
    channelId: joinedId,
    participants,
    speakingIds,
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
