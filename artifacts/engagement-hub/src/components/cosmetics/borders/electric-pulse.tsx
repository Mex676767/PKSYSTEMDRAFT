import type { CosmeticRenderProps } from "../geometry";
import { polar, polygonRingPath } from "../geometry";

export function ElectricPulseBorder({ uid, animated }: CosmeticRenderProps) {
  const gradId = `ep-grad-${uid}`;
  const glowId = `ep-glow-${uid}`;
  const path = polygonRingPath(18, 37, 31);

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={path}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.8}
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-pulse 1.6s ease-in-out infinite" } : undefined}
      />
      <path d={path} fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.5} strokeLinejoin="round" />

      {[30, 120, 210, 300].map((angle, i) => {
        const pos = polar(50, 50, 37, angle);
        return (
          <circle
            key={i}
            cx={pos.x}
            cy={pos.y}
            r={1.1}
            fill="#e0f2fe"
            className={animated ? "cosmetic-anim" : undefined}
            style={animated ? { animation: `cosmetic-twinkle ${1.4 + i * 0.3}s ease-in-out infinite ${i * 0.2}s` } : undefined}
          />
        );
      })}
    </>
  );
}
