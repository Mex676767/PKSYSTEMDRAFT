export function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** All accessories use the actual avatar circle: centre (50, 50), radius 50.
 * Decoration may extend outside 0..100; the SVG viewport stays the avatar size.
 * Keep placement transforms on an outer group and animate a nested group.
 */
export type CosmeticRenderProps = { uid: string; animated: boolean; layer?: "back" | "front" };
