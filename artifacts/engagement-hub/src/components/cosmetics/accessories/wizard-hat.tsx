import type { CosmeticRenderProps } from "../geometry";

export function WizardHatAccessory({ uid, animated }: CosmeticRenderProps) {
  const hatGrad = `wh-hat-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={hatGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>

      <g transform="translate(50 6) rotate(-6)">
        <path d="M -3 24 C -3 24 -1 -6 1 -6 C 3 -6 5 24 5 24 Z" fill={`url(#${hatGrad})`} stroke="#4c1d95" strokeWidth={0.3} />
        <ellipse cx={1} cy={24} rx={13} ry={3} fill={`url(#${hatGrad})`} stroke="#4c1d95" strokeWidth={0.3} />
        <path d="M -8 20 C -6 20 8 20 10 20 L 8 17 L -6 17 Z" fill="#facc15" opacity={0.9} />
        <text x={-1} y={5} fontSize={3.6} fill="#facc15" textAnchor="middle">
          ★
        </text>
        <text x={4} y={13} fontSize={2.4} fill="#e9d5ff" textAnchor="middle">
          ☽
        </text>
      </g>

      {[{ x: 68, y: 10, d: "0s" }, { x: 76, y: 22, d: "0.5s" }, { x: 30, y: 14, d: "1s" }].map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={0.9}
          fill="#fde68a"
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: `cosmetic-twinkle ${1.8 + i * 0.4}s ease-in-out infinite ${s.d}` } : undefined}
        />
      ))}
    </>
  );
}
