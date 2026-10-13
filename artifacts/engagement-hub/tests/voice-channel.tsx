import React from "react";
import { createRoot } from "react-dom/client";
import { useVoiceChannels } from "../src/hooks/use-voice-channel";

// Local-only regression harness: real WebRTC, synthetic microphones, simulated
// authenticated API with deliberately slow requests and dropped responses.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const peer = new URLSearchParams(location.search).get("peer");
const state = window as any;
if (!peer) {
  state.backend = { presence: new Map(), signals: [], sequence: 0, rejected: 0, dropped: new Set(), inFlight: new Map(), peak: 0 };
  const root = document.getElementById("root")!;
  root.innerHTML = `<h1>Voice connection regression</h1><p>Synthetic audio only. Delayed membership, slow signaling, and a lost response for each caller.</p><button id="run">Run two-client test</button><pre id="result">Ready</pre><iframe title="Caller A" src="?peer=a"></iframe><iframe title="Caller B" src="?peer=b"></iframe>`;
  document.getElementById("run")!.onclick = async () => {
    const result = document.getElementById("result")!;
    const frames = [...document.querySelectorAll("iframe")].map((frame) => frame.contentWindow as any);
    const until = async (predicate: () => boolean | Promise<boolean>, label: string) => {
      const deadline = Date.now() + 35000;
      while (!(await predicate())) {
        if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
        await wait(100);
      }
    };
    try {
      result.textContent = "Running…";
      await Promise.all(frames.map((frame) => frame.call.join("regression")));
      await until(() => frames.every((frame) => [...frame.call.connectionStates.values()].includes("connected")), "both callers connected");
      await until(async () => (await Promise.all(frames.map(async (frame) => {
        const stats = await frame.peers[frame.peers.length - 1].getStats();
        return [...stats.values()].some((stat: any) => stat.type === "inbound-rtp" && stat.kind === "audio" && stat.packetsReceived > 0);
      }))).every(Boolean), "audio packets in both directions");
      frames[0].call.toggleMute();
      await until(() => frames[0].call.muted, "mute");
      frames[1].call.toggleDeafen();
      await until(() => frames[1].call.deafened, "deafen");
      if (state.backend.rejected !== 0) throw new Error("Signals sent before membership was confirmed");
      if (state.backend.peak !== 1) throw new Error("Overlapping signaling requests");
      if (state.backend.dropped.size !== 2) throw new Error("Dropped-response scenario did not run");
      frames.forEach((frame) => frame.call.leave());
      await until(() => state.backend.presence.size === 0, "leave removes membership");
      await Promise.all(frames.map((frame) => frame.call.join("regression")));
      await until(() => frames.every((frame) => [...frame.call.connectionStates.values()].includes("connected")), "rejoin");
      frames.forEach((frame) => frame.call.leave());
      result.textContent = "PASS: two connected callers, bidirectional audio packets, delayed membership, lost responses recovered, no overlapping polls, mute/deafen, leave and rejoin.";
    } catch (error) {
      result.textContent = `FAIL: ${error}`;
      frames.forEach((frame) => frame.call?.leave());
    }
  };
} else {
  sessionStorage.removeItem("voice:lastChannel");
  const id = peer === "a" ? "10000000-0000-4000-8000-000000000001" : "20000000-0000-4000-8000-000000000002";
  const backend = (window.parent as any).backend;
  const NativePeer = RTCPeerConnection;
  state.peers = [];
  state.RTCPeerConnection = class extends NativePeer {
    constructor(config: RTCConfiguration) { super({ ...config, iceServers: [] }); state.peers.push(this); }
  };
  const contexts: AudioContext[] = [];
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
    const ctx = new AudioContext();
    contexts.push(ctx);
    await ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain(); gain.gain.value = 0.0001;
    const destination = ctx.createMediaStreamDestination();
    oscillator.connect(gain).connect(destination); oscillator.start();
    return destination.stream;
  } });
  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), location.origin);
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const ok = (data?: unknown, status = 200) => new Response(data === undefined ? null : JSON.stringify(data), { status });
    if (url.pathname.endsWith("turn-credentials")) return ok({ iceServers: [{ urls: "stun:unused.test" }] });
    if (url.pathname.endsWith("/sessions/start") || url.pathname.endsWith("/sessions/stop")) return ok(undefined, 204);
    if (url.pathname === "/api/voice/presence") return ok([...backend.presence.values()]);
    if (url.pathname.endsWith("/presence")) {
      if (init.method === "DELETE") {
        backend.presence.delete(id);
        backend.signals = backend.signals.filter((row: any) => row.payload.from !== id && row.payload.to !== id);
      } else {
        await wait(900);
        backend.presence.set(id, { ...body, id, channel_id: "regression" });
      }
      return ok(undefined, 204);
    }
    if (url.pathname.endsWith("/signals/exchange")) {
      const count = (backend.inFlight.get(id) ?? 0) + 1;
      backend.inFlight.set(id, count); backend.peak = Math.max(backend.peak, count);
      try {
        await wait(700);
        backend.signals = backend.signals.filter((row: any) => row.payload.to !== id || !body.ack.includes(row.id));
        const rows = backend.signals.filter((row: any) => row.payload.to === id);
        if (rows.length && !backend.dropped.has(id)) {
          backend.dropped.add(id);
          throw new TypeError("Simulated lost response");
        }
        return ok(rows);
      } finally { backend.inFlight.set(id, count - 1); }
    }
    if (url.pathname.endsWith("/signals")) {
      if (!backend.presence.has(id) || !backend.presence.has(body.to)) {
        backend.rejected++; return ok({ error: "Missing membership" }, 403);
      }
      backend.signals.push({ id: String(++backend.sequence), payload: body.payload });
      return ok(undefined, 202);
    }
    return ok({ error: `Unexpected ${url.pathname}` }, 404);
  };
  function Caller() {
    const call = useVoiceChannels(["regression"], id, `Caller ${peer}`);
    state.call = call;
    return <pre>{JSON.stringify({ peer, channel: call.channelId, connecting: call.connecting, connections: [...call.connectionStates], error: call.error }, null, 2)}</pre>;
  }
  createRoot(document.getElementById("root")!).render(<Caller />);
}
