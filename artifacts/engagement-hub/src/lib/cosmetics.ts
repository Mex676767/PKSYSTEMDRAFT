export const BORDER_KEYS = [
  "cosmic-orbit",
  "pixel-glitch",
  "electric-pulse",
  "sakura-bloom",
  "trophy-halo",
  "crystal-prism",
  "meteor-trail",
  "galaxy-crown",
] as const;

export type BorderKey = (typeof BORDER_KEYS)[number];

export const BORDER_META: Record<BorderKey, { name: string; tagline: string }> = {
  "cosmic-orbit": { name: "Cosmic Orbit", tagline: "Keep reaching for higher things." },
  "pixel-glitch": { name: "Pixel Glitch", tagline: "A little chaos looks good on you." },
  "electric-pulse": { name: "Electric Pulse", tagline: "Positive energy. Bigger impact." },
  "sakura-bloom": { name: "Sakura Bloom", tagline: "Growth looks good on you." },
  "trophy-halo": { name: "Trophy Halo", tagline: "Celebrate the wins, big and small." },
  "crystal-prism": { name: "Crystal Prism", tagline: "Different perspectives, brighter outcomes." },
  "meteor-trail": { name: "Meteor Trail", tagline: "Make your mark." },
  "galaxy-crown": { name: "Galaxy Crown", tagline: "For those who go beyond." },
};

export function isBorderKey(key: string | null | undefined): key is BorderKey {
  return !!key && (BORDER_KEYS as readonly string[]).includes(key);
}

export const ACCESSORY_KEYS = [
  "angel-wings",
  "neon-headphones",
  "rocket-pack",
  "wizard-hat",
  "cyber-cat-ears",
  "lightning-bolt-aura",
  "floating-hearts",
  "pixel-sword",
  "mini-planet",
  "champion-laurel",
] as const;

export type AccessoryKey = (typeof ACCESSORY_KEYS)[number];

export const ACCESSORY_META: Record<AccessoryKey, { name: string; tagline: string }> = {
  "angel-wings": { name: "Angel Wings", tagline: "Rise above and spread positive vibes." },
  "neon-headphones": { name: "Neon Headphones", tagline: "Good ideas sound better together." },
  "rocket-pack": { name: "Rocket Pack", tagline: "Take your progress to new heights." },
  "wizard-hat": { name: "Wizard Hat", tagline: "Turn great ideas into magic." },
  "cyber-cat-ears": { name: "Cyber Cat Ears", tagline: "Stay curious. Stay awesome." },
  "lightning-bolt-aura": { name: "Lightning Bolt Aura", tagline: "Bringing the energy every day." },
  "floating-hearts": { name: "Floating Hearts", tagline: "Kindness makes everything brighter." },
  "pixel-sword": { name: "Pixel Sword", tagline: "For those who fight for progress." },
  "mini-planet": { name: "Mini Planet", tagline: "A bigger perspective leads to bigger things." },
  "champion-laurel": { name: "Champion Laurel", tagline: "Celebrate your wins, big and small." },
};

export function isAccessoryKey(key: string | null | undefined): key is AccessoryKey {
  return !!key && (ACCESSORY_KEYS as readonly string[]).includes(key);
}

/** How far each decoration draws outside the avatar, as a fraction of the
 * avatar's size (measured in the browser, plus a small margin). UserAvatar
 * reserves this much space so decorations don't cover nearby text. */
export type DecorationExtent = { left: number; right: number; top: number; bottom: number };

export const ACCESSORY_EXTENTS: Record<AccessoryKey, DecorationExtent> = {
  "angel-wings": { left: 0.49, right: 0.49, top: 0.31, bottom: 0 },
  "neon-headphones": { left: 0.36, right: 0.45, top: 0.12, bottom: 0 },
  "rocket-pack": { left: 0, right: 0.42, top: 0.15, bottom: 0.22 },
  "wizard-hat": { left: 0.37, right: 0.24, top: 0.9, bottom: 0 },
  "cyber-cat-ears": { left: 0.37, right: 0.37, top: 0.37, bottom: 0 },
  "lightning-bolt-aura": { left: 0.47, right: 0.46, top: 0.47, bottom: 0.11 },
  "floating-hearts": { left: 0.44, right: 0.45, top: 0.53, bottom: 0.11 },
  "pixel-sword": { left: 0, right: 0.58, top: 0.37, bottom: 0 },
  "mini-planet": { left: 0.28, right: 0.27, top: 0.65, bottom: 0 },
  "champion-laurel": { left: 0.38, right: 0.36, top: 0.39, bottom: 0 },
};

export const BORDER_EXTENTS: Record<BorderKey, DecorationExtent> = {
  "cosmic-orbit": { left: 0.43, right: 0.36, top: 0.31, bottom: 0.31 },
  "pixel-glitch": { left: 0.39, right: 0.39, top: 0.27, bottom: 0.18 },
  "electric-pulse": { left: 0.39, right: 0.43, top: 0.35, bottom: 0.27 },
  "sakura-bloom": { left: 0.37, right: 0.34, top: 0.31, bottom: 0.19 },
  "trophy-halo": { left: 0.34, right: 0.34, top: 0.38, bottom: 0.19 },
  "crystal-prism": { left: 0.32, right: 0.36, top: 0.33, bottom: 0.22 },
  "meteor-trail": { left: 0.39, right: 0.39, top: 0.42, bottom: 0.19 },
  "galaxy-crown": { left: 0.42, right: 0.46, top: 0.4, bottom: 0.25 },
};
