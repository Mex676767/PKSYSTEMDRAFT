import type { CosmeticRenderProps } from "../geometry";

export function NeonHeadphonesAccessory({ uid, animated }: CosmeticRenderProps) {
  const glowId = `nh-glow-${uid}`;
  const cupGrad = `nh-cup-${uid}`;

  return (
    <>
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={cupGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5fd1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      <path d="M 17 40 C 17 14 83 14 83 40" fill="none" stroke={`url(#${cupGrad})`} strokeWidth={2.4} strokeLinecap="round" filter={`url(#${glowId})`} />

      {[17, 83].map((cx, i) => (
        <g key={i}>
          <ellipse cx={cx} cy={44} rx={5.2} ry={7.2} fill="#18181b" stroke={`url(#${cupGrad})`} strokeWidth={1.6} filter={`url(#${glowId})`} />
          <ellipse
            cx={cx}
            cy={44}
            rx={2.6}
            ry={4}
            fill="none"
            stroke="#f5f5ff"
            strokeWidth={0.5}
            opacity={0.7}
            className={animated ? "cosmetic-anim" : undefined}
            style={animated ? { animation: `cosmetic-pulse 1.8s ease-in-out infinite ${i * 0.3}s` } : undefined}
          />
        </g>
      ))}

      {[{ x: 88, y: 20, s: 2.1 }, { x: 94, y: 30, s: 1.4 }].map((n, i) => (
        <text
          key={i}
          x={n.x}
          y={n.y}
          fontSize={n.s * 2.4}
          fill="#f0abfc"
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: `cosmetic-float-y ${2.4 + i * 0.5}s ease-in-out infinite ${i * 0.6}s` } : undefined}
        >
          ♪
        </text>
      ))}
    </>
  );
}
