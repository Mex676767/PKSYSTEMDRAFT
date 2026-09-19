import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to: string; candidate: RTCIceCandidateInit };

export type VoiceParticipant = { id: string; username: string };

export function useVoiceChannel(userId: string | undefined, username: string | undefined) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
  }, []);

  const sendSignal = useCallback((payload: SignalPayload) => {
    rtChannelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const attachAnalyser = useCallback((id: string, stream: MediaStream) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analysersRef.current.set(id, { analyser, data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) });
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

  const join = useCallback(
    async (newChannelId: string) => {
      if (!userId || !username) return;
      setError(null);
      setConnecting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        attachAnalyser(userId, stream);

        const rtChannel = supabase.channel(`voice:${newChannelId}`, {
          config: { presence: { key: userId } },
        });
        rtChannelRef.current = rtChannel;

        rtChannel.on("broadcast", { event: "signal" }, async ({ payload }: { payload: SignalPayload }) => {
          if (payload.to !== userId) return;
          if (payload.type === "offer") {
            const pc = pcsRef.current.get(payload.from) ?? createPeerConnection(payload.from);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({ type: "answer", from: userId, to: payload.from, sdp: answer });
          } else if (payload.type === "answer") {
            const pc = pcsRef.current.get(payload.from);
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } else if (payload.type === "candidate") {
            const pc = pcsRef.current.get(payload.from);
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        });

        rtChannel.on("presence", { event: "sync" }, () => {
          const state = rtChannel.presenceState() as Record<string, { username: string }[]>;
          const list: VoiceParticipant[] = Object.entries(state).map(([id, presences]) => ({
            id,
            username: presences[0]?.username ?? "unknown",
          }));
          setParticipants(list);

          for (const p of list) {
            if (p.id === userId) continue;
            if (!pcsRef.current.has(p.id) && userId < p.id) {
              initiateCall(p.id);
            }
          }
        });

        rtChannel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
          cleanupPeer(key);
        });

        await new Promise<void>((resolve) => {
          rtChannel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await rtChannel.track({ username });
              resolve();
            }
          });
        });

        setChannelId(newChannelId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't access your microphone.");
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      } finally {
        setConnecting(false);
      }
    },
    [userId, username, attachAnalyser, createPeerConnection, sendSignal, cleanupPeer, initiateCall]
  );

  const leave = useCallback(() => {
    for (const peerId of Array.from(pcsRef.current.keys())) cleanupPeer(peerId);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    rtChannelRef.current?.unsubscribe();
    rtChannelRef.current = null;
    setChannelId(null);
    setParticipants([]);
    setSpeakingIds(new Set());
    setMuted(false);
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!channelId) return;
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
  }, [channelId]);

  useEffect(() => {
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { channelId, participants, speakingIds, muted, connecting, error, join, leave, toggleMute };
}
