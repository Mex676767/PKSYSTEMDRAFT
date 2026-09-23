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
