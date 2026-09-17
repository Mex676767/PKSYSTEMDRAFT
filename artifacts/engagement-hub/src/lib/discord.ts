export const DISCORD_CLIENT_ID = "";

export function discordRedirectUri() {
  return window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "") + "/discord-callback";
}

export function buildDiscordAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify",
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export type DiscordPresence = {
  user_id: string;
  discord_id: string;
  voice_channel_id: string | null;
  voice_channel_name: string | null;
  category: "active" | "break" | null;
  presence_status: "online" | "idle" | "dnd" | "offline";
  updated_at: string;
};

export type DiscordDotColor = "green" | "blue" | "white" | "gray";

export function discordDotColor(presence: DiscordPresence | null | undefined): DiscordDotColor {
  if (!presence) return "gray";
  if (presence.voice_channel_id) return presence.category === "break" ? "blue" : "green";
  if (presence.presence_status === "offline") return "gray";
  return "white";
}

export const DISCORD_DOT_CLASS: Record<DiscordDotColor, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  white: "bg-zinc-200 dark:bg-zinc-400",
  gray: "bg-zinc-400/50",
};

export function discordStatusLabel(presence: DiscordPresence | null | undefined): string {
  if (!presence) return "Not connected";
  if (presence.voice_channel_id) {
    const where = presence.voice_channel_name ? ` (${presence.voice_channel_name})` : "";
    return presence.category === "break" ? `On a break${where}` : `In a voice channel${where}`;
  }
  if (presence.presence_status === "offline") return "Offline";
  if (presence.presence_status === "idle") return "Idle";
  return "Online";
}
