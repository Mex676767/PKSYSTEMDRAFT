import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnimatedCosmeticSet } from "@/lib/animated-cosmetics";
import "./animated-catalog.css";

export function AnimatedCatalogDecoration({
  entry, uid, kind, layer, animated,
}: {
  entry: AnimatedCosmeticSet;
  uid: string;
  kind: "set" | "border" | "accessory";
  layer: "back" | "front";
  animated: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  const markup = useMemo(() => {
    const artwork = kind === "set" ? entry[layer]
      : kind === "border" ? entry[layer === "back" ? "borderBack" : "borderFront"]
      : entry[layer === "back" ? "accessoryBack" : "accessoryFront"];
    // Markup comes exclusively from our checked-in, approved SVG artwork.
    // React's unique instance ID keeps gradient references isolated even when
    // the same cosmetic appears multiple times in a feed or shop.
    return artwork ? (`<defs>${entry.defs}</defs>${artwork}`).replaceAll("__COSMETIC_ID__", `catalog-${uid.replace(/[^\w-]/g, "")}`) : "";
  }, [entry, kind, layer, uid]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !animated || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([observation]) => setVisible(observation.isIntersecting), { rootMargin: "128px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [animated, markup]);

  if (!markup) return null;
  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      className={`catalog-cosmetic catalog-${entry.collection} absolute inset-0 w-full h-full overflow-visible pointer-events-none ${!animated ? "catalog-static" : !visible ? "catalog-paused" : ""}`}
      style={{ "--c1": entry.colors[0], "--c2": entry.colors[1], zIndex: layer === "back" ? 0 : kind === "border" ? 20 : 30 } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      {/* Keep the mockup's original viewport as the animation reference box.
          Crop-only viewBoxes would shift its CSS transform origins. */}
      <svg x={-96 * 100 / 108} y={-86 * 100 / 108} width={300 * 100 / 108} height={280 * 100 / 108}
        viewBox="0 0 300 280" overflow="visible" dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}
