import type { CosmeticRenderProps } from "../geometry";

const HEARTS = [
  { x: 22, y: 22, scale: 1, delay: "0s", dur: "3.2s" },
  { x: 80, y: 26, scale: 0.75, delay: "0.9s", dur: "3.6s" },
  { x: 52, y: 8, scale: 0.6, delay: "1.6s", dur: "2.8s" },
];

export function FloatingHeartsAccessory({ uid, animated }: CosmeticRenderProps) {
  const gradId = `fh-grad-${uid}`;
  const heartPath = "M 0 3 C -4 -2 -8 1 -8 4 C -8 8 -3 11 0 14 C 3 11 8 8 8 4 C 8 1 4 -2 0 3 Z";

  return (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffe4f0" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
      </defs>

      {HEARTS.map((h, i) => (
        <g
          key={i}
          transform={`translate(${h.x} ${h.y}) scale(${h.scale})`}
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: `cosmetic-float-y ${h.dur} ease-in-out infinite ${h.delay}` } : undefined}
        >
          <path d={heartPath} fill={`url(#${gradId})`} />
        </g>
      ))}
    </>
  );
}
