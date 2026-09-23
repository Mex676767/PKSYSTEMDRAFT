import type { ComponentType } from "react";
import type { BorderKey } from "@/lib/cosmetics";
import type { CosmeticRenderProps } from "../geometry";
import { CosmicOrbitBorder } from "./cosmic-orbit";
import { PixelGlitchBorder } from "./pixel-glitch";
import { ElectricPulseBorder } from "./electric-pulse";
import { SakuraBloomBorder } from "./sakura-bloom";
import { TrophyHaloBorder } from "./trophy-halo";
import { CrystalPrismBorder } from "./crystal-prism";
import { MeteorTrailBorder } from "./meteor-trail";
import { GalaxyCrownBorder } from "./galaxy-crown";

export const BORDER_RENDERERS: Record<BorderKey, ComponentType<CosmeticRenderProps>> = {
  "cosmic-orbit": CosmicOrbitBorder,
  "pixel-glitch": PixelGlitchBorder,
  "electric-pulse": ElectricPulseBorder,
  "sakura-bloom": SakuraBloomBorder,
  "trophy-halo": TrophyHaloBorder,
  "crystal-prism": CrystalPrismBorder,
  "meteor-trail": MeteorTrailBorder,
  "galaxy-crown": GalaxyCrownBorder,
};
