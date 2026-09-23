import { useId } from "react";
import { isAccessoryKey } from "@/lib/cosmetics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ACCESSORY_RENDERERS } from "@/components/cosmetics/accessories";

export function AccessoryDecoration({ accessory }: { accessory: string | null | undefined }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isAccessoryKey(accessory)) return null;
  const Renderer = ACCESSORY_RENDERERS[accessory];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" style={{ transform: "scale(1.5)" }} aria-hidden="true">
      <Renderer uid={uid} animated={!reducedMotion} />
    </svg>
  );
}
