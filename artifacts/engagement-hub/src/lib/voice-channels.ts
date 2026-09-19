import type { DiscordCategory, DiscordDotColor } from "@/lib/discord";

export type VoiceChannelDef = {
  id: string;
  name: string;
  category: DiscordCategory;
};

export const VOICE_CHANNELS: VoiceChannelDef[] = [
  { id: "general", name: "General", category: "active" },
  { id: "designer", name: "Designer", category: "active" },
  { id: "data-analysis", name: "Data Analysis", category: "active" },
  { id: "marketing", name: "Marketing", category: "active" },
  { id: "retention", name: "Retention - T1 & T2", category: "active" },
  { id: "vip-retention", name: "VIP Retention - Tier 3 & V", category: "active" },
  { id: "training", name: "Training Room", category: "training" },
  { id: "meeting-1", name: "Meeting Room 1", category: "meeting" },
  { id: "meeting-2", name: "Meeting Room 2", category: "meeting" },
  { id: "meeting-3", name: "Meeting Room 3", category: "meeting" },
  { id: "afk", name: "AFK", category: "afk" },
  { id: "lunch-break", name: "Lunch Break/Dinner Break", category: "break" },
];

export const VOICE_CHANNEL_IDS = VOICE_CHANNELS.map((c) => c.id);

export const VOICE_CATEGORY_DOT: Record<DiscordCategory, DiscordDotColor> = {
  active: "green",
  training: "cyan",
  meeting: "violet",
  afk: "amber",
  break: "blue",
};
