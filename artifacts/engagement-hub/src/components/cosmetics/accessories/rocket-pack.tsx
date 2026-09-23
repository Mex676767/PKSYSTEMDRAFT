import type { CosmeticRenderProps } from "../geometry";

export function RocketPackAccessory({ uid, animated }: CosmeticRenderProps) {
  const bodyGrad = `rp-body-${uid}`;
  const flameGrad = `rp-flame-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={bodyGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={flameGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>

      <g transform="translate(75 60) rotate(18)">
        <g
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: "cosmetic-pulse 0.55s ease-in-out infinite", transformOrigin: "0px 10px" } : undefined}
        >
          <path d="M -3.4 10 C -3.4 17 3.4 17 3.4 10 L 2.2 22 L -2.2 22 Z" fill={`url(#${flameGrad})`} />
        </g>
        <rect x={-3.4} y={-10} width={6.8} height={20} rx={3.2} fill={`url(#${bodyGrad})`} stroke="#475569" strokeWidth={0.3} />
        <path d="M -3.4 -10 Q 0 -16 3.4 -10 Z" fill="#f87171" />
        <circle cx={0} cy={-3} r={1.6} fill="#38bdf8" stroke="#0c4a6e" strokeWidth={0.3} />
        <path d="M -3.4 6 L -7 12 L -3.4 12 Z" fill="#cbd5e1" />
        <path d="M 3.4 6 L 7 12 L 3.4 12 Z" fill="#cbd5e1" />
      </g>
    </>
  );
}
