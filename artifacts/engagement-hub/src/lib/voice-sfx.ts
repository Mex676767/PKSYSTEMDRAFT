let sfxCtx: AudioContext | null = null;

function getContext() {
  if (!sfxCtx) sfxCtx = new AudioContext();
  return sfxCtx;
}

function tone(ctx: AudioContext, freq: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.02);
}

export type VoiceCue = "join" | "leave" | "mute" | "unmute" | "deafen" | "undeafen";

export function playVoiceCue(cue: VoiceCue) {
  try {
    const ctx = getContext();
    if (ctx.state === "suspended") ctx.resume();
    switch (cue) {
      case "join":
        tone(ctx, 520, 0, 0.09);
        tone(ctx, 780, 0.09, 0.12);
        break;
      case "leave":
        tone(ctx, 620, 0, 0.09);
        tone(ctx, 380, 0.09, 0.14);
        break;
      case "mute":
        tone(ctx, 340, 0, 0.08);
        break;
      case "unmute":
        tone(ctx, 460, 0, 0.08);
        break;
      case "deafen":
        tone(ctx, 300, 0, 0.07);
        tone(ctx, 240, 0.08, 0.1);
        break;
      case "undeafen":
        tone(ctx, 360, 0, 0.07);
        tone(ctx, 460, 0.08, 0.1);
        break;
    }
  } catch {
    // ignore -- sound cues are a nice-to-have, never block on them
  }
}
