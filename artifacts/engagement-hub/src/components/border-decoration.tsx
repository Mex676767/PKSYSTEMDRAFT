import { useId } from "react";
import { isBorderKey, type LegacyBorderKey } from "@/lib/cosmetics";
import { ANIMATED_COSMETIC_SETS } from "@/lib/animated-cosmetics";
import { AnimatedCatalogDecoration } from "@/components/cosmetics/animated-catalog-decoration";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SpriteBorder } from "@/components/cosmetics/sprite-border";

export function BorderDecoration({ border, layer = "front" }: { border: string | null | undefined; layer?: "back" | "front" }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isBorderKey(border)) return null;
  const entry = ANIMATED_COSMETIC_SETS.find(set => set.borderKey === border);
  if (entry) return <AnimatedCatalogDecoration entry={entry} uid={uid} kind="border" layer={layer} animated={!reducedMotion} />;
  if (layer === "back") return null;
  return <SpriteBorder border={border as LegacyBorderKey} uid={uid} animated={!reducedMotion} />;
}
