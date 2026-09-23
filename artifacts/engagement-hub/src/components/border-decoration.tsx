import { useId } from "react";
import { isBorderKey } from "@/lib/cosmetics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SpriteBorder } from "@/components/cosmetics/sprite-border";

export function BorderDecoration({ border }: { border: string | null | undefined }) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  if (!isBorderKey(border)) return null;
  return <SpriteBorder border={border} uid={uid} animated={!reducedMotion} />;
}
