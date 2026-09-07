// Mirrors the emoji in the accessory_catalog table (see
// profile-customization-setup.sql). Kept here too so the sidebar/avatar can
// show the right emoji without an extra query on every page.
const ACCESSORY_EMOJI: Record<string, string> = {
  star: "⭐",
  flame: "🔥",
  sunglasses: "🕶️",
  tophat: "🎩",
  crown: "👑",
  unicorn: "🦄",
};

export function getAccessoryEmoji(key: string) {
  return ACCESSORY_EMOJI[key] ?? "";
}
