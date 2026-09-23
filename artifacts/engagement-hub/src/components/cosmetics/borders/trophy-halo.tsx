import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

function Leaf({ angle, r, uid }: { angle: number; r: number; uid: string }) {
  const pos = polar(50, 50, r, angle);
  return (
    <ellipse
      cx={pos.x}
      cy={pos.y}
      rx={1.3}
      ry={2.6}
      fill={`url(#th-leaf-${uid})`}
      transform={`rotate(${angle + 90} ${pos.x} ${pos.y})`}
      opacity={0.95}
    />
  );
}

const LEAF_ANGLES = Array.from({ length: 15 }, (_, i) => 200 - i * (220 / 14));

export function TrophyHaloBorder({ uid, animated }: CosmeticRenderProps) {
  const leafGrad = `th-leaf-${uid}`;
  const shineGrad = `th-shine-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={leafGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="55%" stopColor="#ffd75e" />
          <stop offset="100%" stopColor="#c9891a" />
        </linearGradient>
        <linearGradient id={shineGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="50%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {LEAF_ANGLES.map((angle, i) => (
        <Leaf key={i} angle={angle} r={34} uid={uid} />
      ))}

      {/* crown, sitting in the open gap at the top */}
      <g transform="translate(50 15)">
        <path d="M -6 4 L -6 -1 L -3 2 L 0 -3.5 L 3 2 L 6 -1 L 6 4 Z" fill={`url(#${leafGrad})`} stroke="#8a5a2b" strokeWidth={0.3} />
        <circle cx={0} cy={-3.5} r={0.7} fill="#fff2b0" />
        <circle cx={-3} cy={2} r={0.5} fill="#fff2b0" />
        <circle cx={3} cy={2} r={0.5} fill="#fff2b0" />
      </g>

      <g style={{ mixBlendMode: "overlay" }}>
        <g className={animated ? "cosmetic-anim" : undefined} style={animated ? { animation: "cosmetic-pulse 2.4s ease-in-out infinite" } : undefined}>
          <ellipse cx={50} cy={82} rx={9} ry={2.2} fill={`url(#${shineGrad})`} opacity={0.8} />
        </g>
      </g>
    </>
  );
}
