/** Reserve video during the initial handshake so screen sharing cannot collide with
 * another participant's offer or disrupt the microphone connection. */
export function reserveScreenSender(pc: RTCPeerConnection, track?: MediaStreamTrack) {
  return pc.addTransceiver(track ?? "video", {
    direction: "sendrecv",
    sendEncodings: [{ maxBitrate: 1_500_000, maxFramerate: 15 }],
  }).sender;
}

export function clampVoiceVolume(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}
