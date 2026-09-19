import { supabase } from "@/lib/supabase";

// Cloudflare's TURN API token is a real secret (unlike Supabase's publishable
// key), so credentials are generated server-side by the get-turn-credentials
// Supabase Edge Function and fetched here rather than calling Cloudflare
// directly from the browser.

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

let cached: { servers: RTCIceServer[]; expiresAt: number } | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.servers;

  try {
    const { data, error } = await supabase.functions.invoke("get-turn-credentials");
    if (error) throw error;
    const servers = data?.iceServers as RTCIceServer[] | undefined;
    if (!Array.isArray(servers) || servers.length === 0) throw new Error("Empty TURN credential response");
    // Credentials are valid for 24h server-side; refresh a bit early to be safe.
    cached = { servers, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
    return servers;
  } catch (err) {
    console.error("Failed to fetch TURN credentials, falling back to STUN-only", err);
    return FALLBACK_ICE_SERVERS;
  }
}
