import type { CosmeticRenderProps } from "../geometry";
import { polar, polygonRingPath } from "../geometry";

const SHARDS = [
  { angle: 25, r: 45, size: 2.2 },
  { angle: 100, r: 47, size: 1.6 },
  { angle: 170, r: 45, size: 2 },
  { angle: 245, r: 47, size: 1.5 },
  { angle: 315, r: 46, size: 2 },
];

export function CrystalPrismBorder({ uid, animated }: CosmeticRenderProps) {
  const gradId = `cp-grad-${uid}`;
  const shardGrad = `cp-shard-${uid}`;
  const path = polygonRingPath(10, 38, 29);

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="20%" stopColor="#fbbf24" />
          <stop offset="40%" stopColor="#4ade80" />
          <stop offset="60%" stopColor="#38bdf8" />
          <stop offset="80%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f87171" />
        </linearGradient>
        <linearGradient id={shardGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.6} />
        </linearGradient>
      </defs>

      <path d={path} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} strokeLinejoin="miter" />
      <path d={path} fill="none" stroke="#ffffff" strokeWidth={0.4} opacity={0.6} strokeLinejoin="miter" />

      {SHARDS.map((s, i) => {
        const pos = polar(50, 50, s.r, s.angle);
        return (
          <rect
            key={i}
            x={pos.x - s.size / 2}
            y={pos.y - s.size / 2}
            width={s.size}
            height={s.size}
            fill={`url(#${shardGrad})`}
            transform={`rotate(45 ${pos.x} ${pos.y})`}
            className={animated ? "cosmetic-anim" : undefined}
            style={animated ? { animation: `cosmetic-twinkle ${2 + i * 0.35}s ease-in-out infinite ${i * 0.25}s` } : undefined}
          />
        );
      })}

      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="7s" repeatCount="indefinite" />
        )}
        <path d="M 50 16 A 34 34 0 0 1 79 34" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" opacity={0.55} />
      </g>
    </>
  );
}
