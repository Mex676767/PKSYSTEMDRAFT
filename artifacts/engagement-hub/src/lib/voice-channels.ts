export type VoiceCategory = "active" | "training" | "meeting" | "afk" | "break";

export type VoiceChannelDef = {
  id: string;
  name: string;
  category: VoiceCategory;
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

export type VoiceCategoryColor = "green" | "cyan" | "violet" | "amber" | "blue";

export const VOICE_CATEGORY_DOT: Record<VoiceCategory, VoiceCategoryColor> = {
  active: "green",
  training: "cyan",
  meeting: "violet",
  afk: "amber",
  break: "blue",
};

export const VOICE_CATEGORY_DOT_CLASS: Record<VoiceCategoryColor, string> = {
  green: "bg-emerald-500",
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
};

export const VOICE_CATEGORY_BADGE_CLASS: Record<VoiceCategoryColor, string> = {
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blue: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};
