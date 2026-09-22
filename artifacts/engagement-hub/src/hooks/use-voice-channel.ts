import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playVoiceCue } from "@/lib/voice-sfx";
import { getIceServers } from "@/lib/turn-credentials";

type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to: string; candidate: RTCIceCandidateInit };

export type VoiceParticipant = { id: string; username: string; muted: boolean; deafened: boolean; streaming: boolean };

const LAST_CHANNEL_KEY = "voice:lastChannel";

function readPresence(channel: RealtimeChannel): VoiceParticipant[] {
  const state = channel.presenceState() as Record<
    string,
    { username: string; muted?: boolean; deafened?: boolean; streaming?: boolean }[]
  >;
  return Object.entries(state).map(([id, presences]) => ({
    id,
    username: presences[0]?.username ?? "unknown",
    muted: presences[0]?.muted ?? false,
    deafened: presences[0]?.deafened ?? false,
    streaming: presences[0]?.streaming ?? false,
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
  const [volumes, setVolumes] = useState<Map<string, number>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState<Map<string, MediaStream>>(new Map());
  const [audioBlocked, setAudioBlocked] = useState(false);

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const joinedIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingPlaybackRef = useRef<Set<string>>(new Set());
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const stuckTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const joinLockRef = useRef(false);
  const leaveRef = useRef<() => void>(() => {});
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]);
  const deafenedRef = useRef(false);
  const mutedRef = useRef(false);
  const isStreamingRef = useRef(false);
  const volumesRef = useRef<Map<string, number>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
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
    if (pendingPlaybackRef.current.size === 0) setAudioBlocked(false);
    setRemoteVideoStreams((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    const timer = disconnectTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimersRef.current.delete(peerId);
    }
    const stuckTimer = stuckTimersRef.current.get(peerId);
    if (stuckTimer) {
      clearTimeout(stuckTimer);
      stuckTimersRef.current.delete(peerId);
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

  const clearStuckTimer = useCallback((peerId: string) => {
    const timer = stuckTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      stuckTimersRef.current.delete(peerId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      let hasConnectedOnce = false;
      localStreamRef.current?.getTracks().forEach((track) => {
        if (!localStreamRef.current) return;
        const sender = pc.addTrack(track, localStreamRef.current);
        if (track.kind === "audio") {
          // Cap each outgoing voice stream to a sane bitrate (Discord itself
          // runs voice around this range) -- in a mesh, every extra person who
          // joins means another full send+receive stream, and leaving audio
          // uncapped lets it fight for bandwidth as more people talk at once,
          // which is a common cause of calls degrading with 2+ simultaneous
          // speakers on a constrained connection.
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0].maxBitrate = 64_000;
          sender.setParameters(params).catch((err) => console.warn(`[voice] couldn't set bitrate for ${peerId}`, err));
        }
      });
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          if (screenStreamRef.current) pc.addTrack(track, screenStreamRef.current);
        });
      }
      pc.onicecandidate = (e) => {
        if (e.candidate && userId) {
          console.log(`[voice] local ICE candidate for ${peerId}:`, e.candidate.type, e.candidate.candidate);
          sendSignal({ type: "candidate", from: userId, to: peerId, candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        console.log(`[voice] ontrack (${e.track.kind}) fired for ${peerId} -- remote media arrived`);
        const stream = e.streams[0];
        if (e.track.kind === "video") {
          setRemoteVideoStreams((prev) => new Map(prev).set(peerId, stream));
          e.track.onended = () => {
            setRemoteVideoStreams((prev) => {
              if (!prev.has(peerId)) return prev;
              const next = new Map(prev);
              next.delete(peerId);
              return next;
            });
          };
          return;
        }
        let el = audioElsRef.current.get(peerId);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.muted = deafenedRef.current;
          el.volume = volumesRef.current.get(peerId) ?? 1;
          document.body.appendChild(el);
          audioElsRef.current.set(peerId, el);
        }
        el.srcObject = stream;
        el.play()
          .then(() => console.log(`[voice] audio playback started for ${peerId}`))
          .catch((err) => {
            console.warn(`[voice] audio playback BLOCKED for ${peerId}, will retry on next click`, err);
            pendingPlaybackRef.current.add(peerId);
            setAudioBlocked(true);
          });
        attachAnalyser(peerId, stream);
      };
      pc.oniceconnectionstatechange = () => {
        console.log(`[voice] ICE connection state for ${peerId}: ${pc.iceConnectionState}`);
      };
      pc.onnegotiationneeded = async () => {
        // Adding/removing tracks (e.g. starting or stopping a screen share)
        // after the connection is already up triggers this. Ignore it during
        // the very first negotiation -- initiateCall/handleSignal already
        // drive that offer/answer cycle manually, so acting on it here too
        // would race a second, conflicting offer.
        if (!hasConnectedOnce || !userId) return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "offer", from: userId, to: peerId, sdp: offer });
        } catch (err) {
          console.error(`[voice] renegotiation failed for ${peerId}`, err);
        }
      };
      pc.onconnectionstatechange = () => {
        console.log(`[voice] connection state for ${peerId}: ${pc.connectionState}`);
        if (pc.connectionState === "connected") {
          hasConnectedOnce = true;
          clearStuckTimer(peerId);
        }
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
          clearStuckTimer(peerId);
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
      // If the very first connection attempt never completes (a lost offer,
      // answer, or ICE candidate over the realtime broadcast channel -- which
      // has no delivery guarantee), we'd otherwise sit silently disconnected
      // for the whole call. Give it one automatic ICE restart with a fresh
      // offer before giving up. Only the side that would have initiated the
      // original call re-offers, to avoid both sides racing a restart at once.
      const stuckTimer = setTimeout(() => {
        if (hasConnectedOnce || pc.connectionState === "closed") return;
        if (!userId || userId >= peerId) return;
        console.warn(`[voice] ${peerId} never connected after 12s, attempting ICE restart`);
        pc.restartIce();
        pc.createOffer({ iceRestart: true })
          .then(async (offer) => {
            await pc.setLocalDescription(offer);
            sendSignal({ type: "offer", from: userId, to: peerId, sdp: offer });
          })
          .catch((err) => console.error(`[voice] ICE restart offer failed for ${peerId}`, err));
      }, 12000);
      stuckTimersRef.current.set(peerId, stuckTimer);
      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [userId, sendSignal, attachAnalyser, cleanupPeer, clearStuckTimer]
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
      // Guards against the two ways this used to let someone end up joined to
      // two channels at once: (1) clicking Join on a different channel while
      // an earlier join() call is still awaiting getUserMedia/ICE credentials
      // -- neither call could see the other's in-progress state, so both
      // would track() their own channel; and (2) join() never tore down a
      // channel you were already in before joining a new one.
      if (joinLockRef.current) return;
      if (joinedIdRef.current === targetId) return;
      joinLockRef.current = true;
      try {
        if (joinedIdRef.current !== null) {
          leaveRef.current();
        }
        const channel = channelsRef.current.get(targetId);
        if (!channel) return;
        setError(null);
        setConnecting(true);
        try {
          // Explicit, Discord-standard mic processing -- without this, simultaneous
          // speakers (especially anyone on speakers rather than headphones) can
          // produce feedback/howling that sounds like the call "breaking". Browsers
          // sometimes default these on already, but only inconsistently, so they're
          // requested explicitly rather than relying on that.
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
            video: false,
          });
          localStreamRef.current = stream;
          attachAnalyser(userId, stream);
          iceServersRef.current = await getIceServers();
          console.log("[voice] ICE servers for this call:", iceServersRef.current);

          joinedIdRef.current = targetId;
          mutedRef.current = false;
          isStreamingRef.current = false;
          await channel.track({ username, muted: false, deafened: false, streaming: false });
          setParticipants(readPresence(channel));
          setJoinedId(targetId);
          supabase.rpc("join_voice_session", { p_channel_id: targetId }).then(({ error: rpcError }) => {
            if (rpcError) console.error("Failed to record voice session start", rpcError);
          });
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
      } finally {
        joinLockRef.current = false;
      }
    },
    [userId, username, attachAnalyser]
  );

  const leave = useCallback(() => {
    const wasConnected = joinedIdRef.current !== null;
    const channel = joinedIdRef.current ? channelsRef.current.get(joinedIdRef.current) : null;
    if (wasConnected) {
      supabase.rpc("leave_voice_session").then(({ error: rpcError }) => {
        if (rpcError) console.error("Failed to record voice session end", rpcError);
      });
    }
    for (const peerId of Array.from(pcsRef.current.keys())) cleanupPeer(peerId);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
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
    setIsStreaming(false);
    setRemoteVideoStreams(new Map());
    setVolumes(new Map());
    volumesRef.current = new Map();
    deafenedRef.current = false;
    mutedRef.current = false;
    isStreamingRef.current = false;
    pendingPlaybackRef.current.clear();
    setAudioBlocked(false);
    if (wasConnected) playVoiceCue("leave");
  }, [cleanupPeer]);
  leaveRef.current = leave;

  const setParticipantVolume = useCallback((peerId: string, volume: number) => {
    setVolumes((prev) => {
      const next = new Map(prev);
      next.set(peerId, volume);
      volumesRef.current = next;
      return next;
    });
    const el = audioElsRef.current.get(peerId);
    if (el) el.volume = volume;
  }, []);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      screenStreamRef.current = stream;
      track.onended = () => stopScreenShareRef.current();
      pcsRef.current.forEach((pc) => {
        pc.addTrack(track, stream);
      });
      isStreamingRef.current = true;
      setIsStreaming(true);
      if (username) {
        activeChannel()?.track({ username, muted: mutedRef.current, deafened: deafenedRef.current, streaming: true });
      }
    } catch (err) {
      console.error("[voice] failed to start screen share", err);
    }
  }, [activeChannel, username]);

  const stopScreenShare = useCallback(() => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) pc.removeTrack(sender);
    });
    stream.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    isStreamingRef.current = false;
    setIsStreaming(false);
    if (username) {
      activeChannel()?.track({ username, muted: mutedRef.current, deafened: deafenedRef.current, streaming: false });
    }
  }, [activeChannel, username]);

  const stopScreenShareRef = useRef(stopScreenShare);
  stopScreenShareRef.current = stopScreenShare;

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      if (username) {
        activeChannel()?.track({ username, muted: next, deafened: deafenedRef.current, streaming: isStreamingRef.current });
      }
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
    if (username) {
      activeChannel()?.track({ username, muted: mutedRef.current, deafened: next, streaming: isStreamingRef.current });
    }
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

  // Browsers can silently block autoplay on an <audio> element created
  // asynchronously in pc.ontrack -- by the time the remote track actually
  // arrives (after ICE negotiation), the original Join click's user-gesture
  // window may already have expired, and the browser rejects play() with no
  // visible error. This is the single most common cause of one-sided audio
  // ("I can hear them but they can't hear me"), and it's especially common on
  // mobile Safari, which is far stricter about what counts as a real user
  // gesture -- background retries (click/keydown listeners, polling) are NOT
  // trusted gestures there and can keep failing silently forever. unlockAudio
  // is exposed so the UI can show an explicit "tap to enable audio" button,
  // which IS a trusted gesture and reliably unblocks it.
  const unlockAudio = useCallback(() => {
    if (pendingPlaybackRef.current.size === 0) return;
    for (const peerId of Array.from(pendingPlaybackRef.current)) {
      const el = audioElsRef.current.get(peerId);
      if (!el) {
        pendingPlaybackRef.current.delete(peerId);
        continue;
      }
      el.play()
        .then(() => {
          pendingPlaybackRef.current.delete(peerId);
          console.log(`[voice] recovered blocked playback for ${peerId}`);
          if (pendingPlaybackRef.current.size === 0) setAudioBlocked(false);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!joinedId) return;
    document.addEventListener("click", unlockAudio);
    document.addEventListener("mousedown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("touchend", unlockAudio);
    const pollTimer = setInterval(unlockAudio, 2000);
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("mousedown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchend", unlockAudio);
      clearInterval(pollTimer);
    };
  }, [joinedId, unlockAudio]);

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
    volumes,
    setParticipantVolume,
    isStreaming,
    remoteVideoStreams,
    startScreenShare,
    stopScreenShare,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    audioBlocked,
    unlockAudio,
  };
}
