export function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** A closed ring path alternating between outerR/innerR every spike, connected with straight facets. */
export function polygonRingPath(spikes: number, outerR: number, innerR: number, cx = 50, cy = 50) {
  const n = spikes * 2;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * 360;
    const r = i % 2 === 0 ? outerR : innerR;
    const p = polar(cx, cy, r, angle);
    pts.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

export type CosmeticRenderProps = { uid: string; animated: boolean };
