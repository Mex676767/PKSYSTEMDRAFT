import type { CosmeticRenderProps } from "../geometry";

const BOLTS = [
  { transform: "translate(14 24) rotate(-12) scale(0.9)", delay: "0s" },
  { transform: "translate(80 32) rotate(18) scale(1.1) scale(-1 1)", delay: "0.25s" },
  { transform: "translate(20 74) rotate(8) scale(0.75)", delay: "0.5s" },
];

export function LightningBoltAuraAccessory({ uid, animated }: CosmeticRenderProps) {
  const gradId = `lb-grad-${uid}`;
  const glowId = `lb-glow-${uid}`;
  const boltPath = "M 4 0 L -3 9 L 1 9 L -2 18 L 6 7 L 2 7 Z";

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {BOLTS.map((b, i) => (
        <g
          key={i}
          transform={b.transform}
          className={animated ? "cosmetic-anim" : undefined}
          style={animated ? { animation: `cosmetic-flicker 1.6s steps(1) infinite ${b.delay}` } : undefined}
        >
          <path d={boltPath} fill={`url(#${gradId})`} stroke="#fffbeb" strokeWidth={0.3} filter={`url(#${glowId})`} />
        </g>
      ))}
    </>
  );
}
