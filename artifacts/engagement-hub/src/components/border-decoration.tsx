import { useId } from "react";
import { isBorderKey } from "@/lib/cosmetics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BORDER_RENDERERS } from "@/components/cosmetics/borders";

export function BorderDecoration({ border }: { border: string | null | undefined }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isBorderKey(border)) return null;
  const Renderer = BORDER_RENDERERS[border];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: "scale(1.5)" }} aria-hidden="true">
      <Renderer uid={uid} animated={!reducedMotion} />
    </svg>
  );
}
