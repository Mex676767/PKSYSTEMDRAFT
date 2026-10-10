import { apiRequest } from "@/lib/api";

// Cloudflare's TURN API token stays in the DigitalOcean API service. The
// browser receives only short-lived ICE server credentials.

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

let cached: { servers: RTCIceServer[]; expiresAt: number } | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.servers;

  try {
    const data = await apiRequest<{iceServers?:RTCIceServer[]}>("/voice/turn-credentials");
    const servers = data?.iceServers;
    if (!Array.isArray(servers) || servers.length === 0) throw new Error("Empty TURN credential response");
    // Coturn credentials are valid for 10 minutes; refresh after 8 minutes.
    cached = { servers, expiresAt: Date.now() + 8 * 60 * 1000 };
    return servers;
  } catch (err) {
    console.error("Failed to fetch TURN credentials, falling back to STUN-only", err);
    return FALLBACK_ICE_SERVERS;
  }
}
