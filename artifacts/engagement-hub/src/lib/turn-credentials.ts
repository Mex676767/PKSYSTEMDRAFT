// Metered.ca free-tier TURN relay. The subdomain and API key come from a
// Metered "TURN app" -- the API key only vends short-lived TURN credentials,
// it doesn't grant account access, so it's safe to ship in client code (same
// reasoning as the Supabase publishable key in src/lib/supabase.ts).
const METERED_SUBDOMAIN = "";
const METERED_API_KEY = "";

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

let cached: { servers: RTCIceServer[]; expiresAt: number } | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!METERED_SUBDOMAIN || !METERED_API_KEY) return FALLBACK_ICE_SERVERS;

  if (cached && cached.expiresAt > Date.now()) return cached.servers;

  try {
    const res = await fetch(
      `https://${METERED_SUBDOMAIN}.metered.ca/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!res.ok) throw new Error(`Metered credentials request failed: ${res.status}`);
    const servers = (await res.json()) as RTCIceServer[];
    if (!Array.isArray(servers) || servers.length === 0) throw new Error("Empty TURN credential response");
    // Credentials are valid for 24h server-side; refresh a bit early to be safe.
    cached = { servers, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
    return servers;
  } catch (err) {
    console.error("Failed to fetch TURN credentials, falling back to STUN-only", err);
    return FALLBACK_ICE_SERVERS;
  }
}
