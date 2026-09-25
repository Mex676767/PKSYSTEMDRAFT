import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { reserveScreenSender, clampVoiceVolume } from '../src/lib/voice-media';
import { ScreenShareTile } from '../src/components/screen-share-tile';
import '../src/index.css';

// Local-only peers and synthetic video. No microphone, screen picker or Supabase.
function App() {
  const [result, setResult] = useState('Ready');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    const a = new RTCPeerConnection({iceServers: []});
    const b = new RTCPeerConnection({iceServers: []});
    const captures: MediaStream[] = [];
    let timer = 0;
    const wait = async (condition: () => boolean, message: string) => {
      const until = Date.now() + 10000;
      while (!condition()) { if (Date.now() > until) throw new Error(message); await new Promise(r => setTimeout(r, 50)); }
    };
    try {
      const sendA = reserveScreenSender(a), sendB = reserveScreenSender(b);
      const candidatesA: RTCIceCandidate[] = [], candidatesB: RTCIceCandidate[] = [];
      a.onicecandidate = e => { if (e.candidate) candidatesB.push(e.candidate); };
      b.onicecandidate = e => { if (e.candidate) candidatesA.push(e.candidate); };
      let videoA: MediaStreamTrack | undefined, videoB: MediaStreamTrack | undefined;
      a.ontrack = e => { videoA = e.track; };
      b.ontrack = e => { videoB = e.track; setStream(new MediaStream([e.track])); };
      await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription!);
      await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription!);
      await wait(() => a.iceGatheringState === 'complete' && b.iceGatheringState === 'complete', 'ICE gathering');
      for (const c of candidatesA) await a.addIceCandidate(c);
      for (const c of candidatesB) await b.addIceCandidate(c);
      await wait(() => a.connectionState === 'connected' && b.connectionState === 'connected', 'Peer connection');
      let renegotiations = 0;
      a.onnegotiationneeded = b.onnegotiationneeded = () => { renegotiations++; };
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      const draw = () => { ctx.fillStyle = '#211036'; ctx.fillRect(0,0,1280,720);ctx.fillStyle = '#ff60ab';ctx.font='60px sans-serif';ctx.fillText('C9 / C6 screen-share test',90,320);ctx.fillStyle='white';ctx.font='30px sans-serif';ctx.fillText(new Date().toISOString(),90,390); };
      draw(); timer = window.setInterval(draw, 100);
      const capture = canvas.captureStream(15); captures.push(capture);
      await Promise.all([sendA.replaceTrack(capture.getVideoTracks()[0]), sendB.replaceTrack(capture.getVideoTracks()[0])]);
      await wait(() => !!videoA && !videoA.muted && !!videoB && !videoB.muted, 'Both simultaneous streams');
      await Promise.all([sendA.replaceTrack(null),sendB.replaceTrack(null)]);
      if (sendA.track || sendB.track) throw new Error('Stop did not detach capture');
      const second = canvas.captureStream(15); captures.push(second);
      await sendA.replaceTrack(second.getVideoTracks()[0]);
      await wait(() => !!videoB && !videoB.muted, 'Restart stream');
      const stats = await b.getStats();
      if (![...stats.values()].some(s => s.type === 'inbound-rtp' && s.kind === 'video' && s.framesDecoded > 0)) throw new Error('No decoded remote frames');
      if (renegotiations) throw new Error('Sharing renegotiated the call');
      if (clampVoiceVolume(1.5)!==1 || clampVoiceVolume(-1)!==0 || clampVoiceVolume(NaN)!==1) throw new Error('Volume clamp');
      setResult('PASS: initial connection, simultaneous shares, stop, restart, decoded video, no renegotiation, volume limits. Preview stays live for 30 seconds.');
      await new Promise(r=>setTimeout(r,30000));
    } catch(e) { setResult('FAIL: '+String(e)); }
    finally { clearInterval(timer); captures.forEach(s=>s.getTracks().forEach(t=>t.stop()));a.close();b.close();setStream(null);setRunning(false); }
  }
  return <main style={{padding:32,maxWidth:960,margin:'auto'}}><h1>Local WebRTC regression check</h1><button disabled={running} onClick={run} style={{padding:12,border:'1px solid',margin:'20px 0'}}>Run local tests</button><p role="status">{result}</p>{stream && <ScreenShareTile stream={stream} label="Synthetic remote screen"/>}</main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
