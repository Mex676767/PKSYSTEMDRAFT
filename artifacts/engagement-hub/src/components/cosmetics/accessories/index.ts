import type { ComponentType } from "react";
import type { AccessoryKey } from "@/lib/cosmetics";
import type { CosmeticRenderProps } from "../geometry";
import { AngelWingsAccessory } from "./angel-wings";
import { NeonHeadphonesAccessory } from "./neon-headphones";
import { RocketPackAccessory } from "./rocket-pack";
import { WizardHatAccessory } from "./wizard-hat";
import { CyberCatEarsAccessory } from "./cyber-cat-ears";
import { LightningBoltAuraAccessory } from "./lightning-bolt-aura";
import { FloatingHeartsAccessory } from "./floating-hearts";
import { PixelSwordAccessory } from "./pixel-sword";
import { MiniPlanetAccessory } from "./mini-planet";
import { ChampionLaurelAccessory } from "./champion-laurel";

export const ACCESSORY_RENDERERS: Record<AccessoryKey, ComponentType<CosmeticRenderProps>> = {
  "angel-wings": AngelWingsAccessory,
  "neon-headphones": NeonHeadphonesAccessory,
  "rocket-pack": RocketPackAccessory,
  "wizard-hat": WizardHatAccessory,
  "cyber-cat-ears": CyberCatEarsAccessory,
  "lightning-bolt-aura": LightningBoltAuraAccessory,
  "floating-hearts": FloatingHeartsAccessory,
  "pixel-sword": PixelSwordAccessory,
  "mini-planet": MiniPlanetAccessory,
  "champion-laurel": ChampionLaurelAccessory,
};
