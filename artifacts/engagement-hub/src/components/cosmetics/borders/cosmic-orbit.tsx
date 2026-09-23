import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

const PLANETS = [
  { r: 43, size: 3.6, colorA: "#fde68a", colorB: "#f59e0b", start: 20, dur: "9s" },
  { r: 46, size: 2.6, colorA: "#fca5a5", colorB: "#ef4444", start: 160, dur: "13s", reverse: true },
  { r: 41, size: 2.2, colorA: "#a5f3fc", colorB: "#0891b2", start: 260, dur: "16s" },
];

export function CosmicOrbitBorder({ uid, animated }: CosmeticRenderProps) {
  const ringGrad = `co-ring-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={ringGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      <circle cx={50} cy={50} r={34} fill="none" stroke={`url(#${ringGrad})`} strokeWidth={2.4} opacity={0.9} />
      <circle cx={50} cy={50} r={34} fill="none" stroke="#c4b5fd" strokeWidth={0.6} opacity={0.5} />

      {PLANETS.map((p, i) => {
        const pos = polar(50, 50, p.r, p.start);
        const gradId = `co-planet-${uid}-${i}`;
        return (
          <g key={i}>
            <defs>
              <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={p.colorA} />
                <stop offset="100%" stopColor={p.colorB} />
              </radialGradient>
            </defs>
            <g>
              {animated && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={p.reverse ? `${p.start} 50 50` : `${p.start} 50 50`}
                  to={p.reverse ? `${p.start - 360} 50 50` : `${p.start + 360} 50 50`}
                  dur={p.dur}
                  repeatCount="indefinite"
                />
              )}
              <circle cx={pos.x} cy={pos.y} r={p.size} fill={`url(#${gradId})`} />
            </g>
          </g>
        );
      })}

      <g className="cosmetic-anim" style={{ animation: "cosmetic-twinkle 2.6s ease-in-out infinite" }}>
        <circle cx={22} cy={30} r={0.9} fill="#fff" />
      </g>
      <g className="cosmetic-anim" style={{ animation: "cosmetic-twinkle 3.2s ease-in-out infinite 0.6s" }}>
        <circle cx={78} cy={68} r={0.7} fill="#fff" />
      </g>
    </>
  );
}
