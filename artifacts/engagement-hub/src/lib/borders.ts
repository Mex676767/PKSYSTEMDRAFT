// Mirrors the border_catalog table (see profile-photo-borders-setup.sql).
// Tailwind's build-time scanner needs full literal class strings -- a
// template like `bg-${color}` never gets generated into the compiled CSS,
// so each border's look is spelled out here as a static lookup instead
// (same fix as COLOR_STYLES in games.tsx).
export const BORDER_STYLES: Record<string, string> = {
  bronze: "bg-amber-700",
  silver: "bg-slate-300",
  gold: "bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.6)]",
  neon: "bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-[0_0_12px_rgba(217,70,239,0.6)]",
  rainbow: "bg-gradient-to-br from-red-500 via-yellow-400 via-green-400 via-blue-500 to-purple-500",
};

export function getBorderStyle(key: string | null | undefined) {
  return key ? BORDER_STYLES[key] : undefined;
}
