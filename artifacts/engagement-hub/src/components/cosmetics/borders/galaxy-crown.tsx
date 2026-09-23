import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

export function GalaxyCrownBorder({ uid, animated }: CosmeticRenderProps) {
  const ringGrad = `gc-ring-${uid}`;
  const crownGrad = `gc-crown-${uid}`;
  const moonGrad = `gc-moon-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={ringGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id={crownGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="55%" stopColor="#ffd75e" />
          <stop offset="100%" stopColor="#c9891a" />
        </linearGradient>
        <radialGradient id={moonGrad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
      </defs>

      <circle cx={50} cy={50} r={33} fill="none" stroke={`url(#${ringGrad})`} strokeWidth={2} opacity={0.85} />
      <circle cx={50} cy={50} r={33} fill="none" stroke="#e9d5ff" strokeWidth={0.5} opacity={0.5} />

      <g transform="translate(50 14)">
        <path d="M -6.5 4.5 L -6.5 -0.5 L -3.2 2.3 L 0 -3.8 L 3.2 2.3 L 6.5 -0.5 L 6.5 4.5 Z" fill={`url(#${crownGrad})`} stroke="#8a5a2b" strokeWidth={0.3} />
        <circle cx={0} cy={-3.8} r={0.7} fill="#fff2b0" />
      </g>

      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from="30 50 50" to="390 50 50" dur="11s" repeatCount="indefinite" />
        )}
        <circle cx={polar(50, 50, 45, 30).x} cy={polar(50, 50, 45, 30).y} r={3} fill={`url(#${moonGrad})`} />
        <ellipse
          cx={polar(50, 50, 45, 30).x}
          cy={polar(50, 50, 45, 30).y}
          rx={4.6}
          ry={1.1}
          fill="none"
          stroke="#c7d2fe"
          strokeWidth={0.5}
          opacity={0.8}
        />
      </g>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from="190 50 50" to="-170 50 50" dur="15s" repeatCount="indefinite" />
        )}
        <circle cx={polar(50, 50, 42, 190).x} cy={polar(50, 50, 42, 190).y} r={1.8} fill="#fda4af" />
      </g>

      <g className={animated ? "cosmetic-anim" : undefined} style={animated ? { animation: "cosmetic-twinkle 2.8s ease-in-out infinite" } : undefined}>
        <circle cx={20} cy={62} r={0.8} fill="#fff" />
      </g>
    </>
  );
}
