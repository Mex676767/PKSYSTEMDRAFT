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
