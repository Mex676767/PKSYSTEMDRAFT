import { useId } from "react";
import { isAccessoryKey, type LegacyAccessoryKey } from "@/lib/cosmetics";
import { ANIMATED_COSMETIC_SETS } from "@/lib/animated-cosmetics";
import { AnimatedCatalogDecoration } from "@/components/cosmetics/animated-catalog-decoration";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ACCESSORY_RENDERERS } from "@/components/cosmetics/accessories";

export function AccessoryDecoration({ accessory, layer = "front" }: { accessory: string | null | undefined; layer?: "back" | "front" }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isAccessoryKey(accessory)) return null;
  const entry = ANIMATED_COSMETIC_SETS.find(set => set.accessoryKey === accessory);
  if (entry) return <AnimatedCatalogDecoration entry={entry} uid={uid} kind="accessory" layer={layer} animated={!reducedMotion} />;
  const behindAvatar = accessory === "angel-wings" || accessory === "rocket-pack" || accessory === "pixel-sword";
  if (layer === "back" && !behindAvatar) return null;
  if (layer === "front" && (accessory === "rocket-pack" || accessory === "pixel-sword")) return null;
  const Renderer = ACCESSORY_RENDERERS[accessory as LegacyAccessoryKey];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: layer === "back" ? 0 : 30 }} aria-hidden="true" focusable="false">
      <Renderer uid={uid} animated={!reducedMotion} layer={layer} />
    </svg>
  );
}
