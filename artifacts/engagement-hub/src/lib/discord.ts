export const DISCORD_CLIENT_ID = "1550219573771636746";

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

export type DiscordCategory = "active" | "training" | "meeting" | "afk" | "break";

export type DiscordPresence = {
  user_id: string;
  discord_id: string;
  voice_channel_id: string | null;
  voice_channel_name: string | null;
  category: DiscordCategory | null;
  presence_status: "online" | "idle" | "dnd" | "offline";
  updated_at: string;
};

export type DiscordDotColor = "green" | "cyan" | "violet" | "amber" | "blue" | "white" | "gray";

export function discordDotColor(presence: DiscordPresence | null | undefined): DiscordDotColor {
  if (!presence) return "gray";
  if (presence.voice_channel_id) {
    switch (presence.category) {
      case "training": return "cyan";
      case "meeting": return "violet";
      case "afk": return "amber";
      case "break": return "blue";
      default: return "green";
    }
  }
  if (presence.presence_status === "offline") return "gray";
  return "white";
}

export const DISCORD_DOT_CLASS: Record<DiscordDotColor, string> = {
  green: "bg-emerald-500",
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  white: "bg-zinc-200 dark:bg-zinc-400",
  gray: "bg-zinc-400/50",
};

const CATEGORY_LABEL: Record<DiscordCategory, string> = {
  active: "Active",
  training: "In training",
  meeting: "In a meeting",
  afk: "AFK",
  break: "On a break",
};

export function discordStatusLabel(presence: DiscordPresence | null | undefined): string {
  if (!presence) return "Not connected";
  if (presence.voice_channel_id) {
    const where = presence.voice_channel_name ? ` (${presence.voice_channel_name})` : "";
    const label = presence.category ? CATEGORY_LABEL[presence.category] : "In a voice channel";
    return `${label}${where}`;
  }
  if (presence.presence_status === "offline") return "Offline";
  if (presence.presence_status === "idle") return "Idle";
  return "Online";
}

export function discordShortStatusLabel(presence: DiscordPresence | null | undefined): string {
  if (!presence) return "Not connected";
  if (presence.voice_channel_id) {
    return presence.category ? CATEGORY_LABEL[presence.category] : "In a voice channel";
  }
  if (presence.presence_status === "offline") return "Offline";
  if (presence.presence_status === "idle") return "Idle";
  return "Online";
}
