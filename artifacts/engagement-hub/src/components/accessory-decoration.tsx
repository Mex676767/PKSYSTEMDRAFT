import { useId } from "react";
import { isAccessoryKey } from "@/lib/cosmetics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ACCESSORY_RENDERERS } from "@/components/cosmetics/accessories";

export function AccessoryDecoration({ accessory, layer = "front" }: { accessory: string | null | undefined; layer?: "back" | "front" }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isAccessoryKey(accessory)) return null;
  const behindAvatar = accessory === "angel-wings" || accessory === "rocket-pack" || accessory === "pixel-sword";
  if (layer === "back" && !behindAvatar) return null;
  if (layer === "front" && (accessory === "rocket-pack" || accessory === "pixel-sword")) return null;
  const Renderer = ACCESSORY_RENDERERS[accessory];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: layer === "back" ? 0 : 30 }} aria-hidden="true" focusable="false">
      <Renderer uid={uid} animated={!reducedMotion} layer={layer} />
    </svg>
  );
}
