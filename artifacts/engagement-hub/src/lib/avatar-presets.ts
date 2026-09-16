export type AvatarPreset = { id: string; emoji: string; colors: [string, string] };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "fox", emoji: "🦊", colors: ["#f97316", "#c2410c"] },
  { id: "cat", emoji: "🐱", colors: ["#a855f7", "#7e22ce"] },
  { id: "panda", emoji: "🐼", colors: ["#64748b", "#334155"] },
  { id: "robot", emoji: "🤖", colors: ["#06b6d4", "#0e7490"] },
  { id: "alien", emoji: "👽", colors: ["#22c55e", "#15803d"] },
  { id: "ghost", emoji: "👻", colors: ["#8b5cf6", "#5b21b6"] },
  { id: "unicorn", emoji: "🦄", colors: ["#ec4899", "#be185d"] },
  { id: "dragon", emoji: "🐲", colors: ["#ef4444", "#b91c1c"] },
  { id: "owl", emoji: "🦉", colors: ["#d97706", "#92400e"] },
  { id: "koala", emoji: "🐨", colors: ["#94a3b8", "#475569"] },
  { id: "penguin", emoji: "🐧", colors: ["#3b82f6", "#1d4ed8"] },
  { id: "lion", emoji: "🦁", colors: ["#eab308", "#a16207"] },
  { id: "octopus", emoji: "🐙", colors: ["#db2777", "#9d174d"] },
  { id: "shark", emoji: "🦈", colors: ["#0ea5e9", "#0369a1"] },
  { id: "wizard", emoji: "🧙", colors: ["#6366f1", "#4338ca"] },
  { id: "ninja", emoji: "🥷", colors: ["#334155", "#0f172a"] },
];

export function avatarPresetDataUri(preset: AvatarPreset): string {
  const [from, to] = preset.colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${from}" />
        <stop offset="100%" stop-color="${to}" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#g)" />
    <text x="50" y="58" font-size="52" text-anchor="middle" dominant-baseline="middle">${preset.emoji}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function presetIdFromAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl?.startsWith("data:image/svg+xml,")) return null;
  const preset = AVATAR_PRESETS.find((p) => avatarUrl === avatarPresetDataUri(p));
  return preset?.id ?? null;
}
