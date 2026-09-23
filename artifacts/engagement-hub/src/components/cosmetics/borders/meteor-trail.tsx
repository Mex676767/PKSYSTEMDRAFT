import type { CosmeticRenderProps } from "../geometry";

export function MeteorTrailBorder({ uid, animated }: CosmeticRenderProps) {
  const trailGrad = `mt-trail-${uid}`;
  const cometGrad = `mt-comet-${uid}`;
  const orbitPathId = `mt-orbit-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={trailGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0} />
          <stop offset="60%" stopColor="#f97316" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.95} />
        </linearGradient>
        <radialGradient id={cometGrad} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="55%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <path id={orbitPathId} d="M 50 15 A 35 35 0 1 1 49.9 15" fill="none" />
      </defs>

      <path
        d="M 15 65 A 35 35 0 0 1 50 15"
        fill="none"
        stroke={`url(#${trailGrad})`}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.85}
      />

      {[0.5, 0.65, 0.8].map((r, i) => (
        <circle key={i} r={0.8 - i * 0.2} fill="#fde68a" opacity={0.7 - i * 0.15}>
          {animated && (
            <animateMotion dur="6s" repeatCount="indefinite" begin={`${-i * 0.35}s`} rotate="auto">
              <mpath href={`#${orbitPathId}`} xlinkHref={`#${orbitPathId}`} />
            </animateMotion>
          )}
        </circle>
      ))}

      <g>
        <circle r={3.1} fill={`url(#${cometGrad})`}>
          {animated && (
            <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${orbitPathId}`} xlinkHref={`#${orbitPathId}`} />
            </animateMotion>
          )}
        </circle>
      </g>

      {[{ x: 78, y: 60 }, { x: 25, y: 78 }].map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={0.7}
          fill="#fff"
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: `cosmetic-twinkle ${2 + i * 0.5}s ease-in-out infinite ${i * 0.4}s` } : undefined}
        />
      ))}
    </>
  );
}
