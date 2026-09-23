import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

export function MiniPlanetAccessory({ uid, animated }: CosmeticRenderProps) {
  const planetGrad = `mp-planet-${uid}`;
  const moonGrad = `mp-moon-${uid}`;
  const px = 80;
  const py = 78;

  return (
    <>
      <defs>
        <radialGradient id={planetGrad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id={moonGrad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </radialGradient>
      </defs>

      <g transform={`translate(${px} ${py}) rotate(-18)`}>
        <ellipse cx={0} cy={0} rx={7.5} ry={2.3} fill="none" stroke="#fde68a" strokeWidth={1.1} opacity={0.9} />
        <circle cx={0} cy={0} r={4.6} fill={`url(#${planetGrad})`} />
        <ellipse cx={0} cy={0} rx={7.5} ry={2.3} fill="none" stroke="#fef3c7" strokeWidth={0.5} opacity={0.6} />
      </g>

      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from={`0 ${px} ${py}`} to={`360 ${px} ${py}`} dur="8s" repeatCount="indefinite" />
        )}
        <circle cx={polar(px, py, 11, 0).x} cy={polar(px, py, 11, 0).y} r={1.6} fill={`url(#${moonGrad})`} />
      </g>

      <g
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-twinkle 2.4s ease-in-out infinite" } : undefined}
      >
        <circle cx={18} cy={20} r={0.8} fill="#fff" />
      </g>
    </>
  );
}
