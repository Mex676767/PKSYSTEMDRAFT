import type { CosmeticRenderProps } from "../geometry";
import { Glow, bob } from "../details";

const HEARTS = [
  [-23, 23, 1.15],
  [18, -19, 0.8],
  [65, -34, 0.95],
  [116, 9, 1.05],
  [128, 66, 0.95],
  [-17, 80, 0.9],
  [102, 101, 0.55],
] as const;
export function FloatingHeartsAccessory({
  uid,
  animated,
}: CosmeticRenderProps) {
  const color = `fh-color-${uid}`,
    glow = `fh-glow-${uid}`;
  return (
    <>
      <defs>
        <radialGradient id={color} cx="30%" cy="20%" r="85%">
          <stop stopColor="#fff2fc" />
          <stop offset=".32" stopColor="#ff78c5" />
          <stop offset="1" stopColor="#f00072" />
        </radialGradient>
        <Glow id={glow} />
      </defs>
      {HEARTS.map(([x, y, size], i) => (
        <g
          key={i}
          transform={`translate(${x} ${y}) rotate(${i % 2 ? 15 : -15}) scale(${size})`}
        >
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={bob(animated, -i * 0.6)}
          >
            <path
              d="M0 12 C-20 0 -13 -16 -3 -9 L0 -6 L3 -9 C13 -16 20 0 0 12Z"
              fill={`url(#${color})`}
              stroke="#ff9bdc"
              strokeWidth="1"
              filter={`url(#${glow})`}
            />
            <path
              d="M-10 -3 Q-10 -8 -6 -7"
              fill="none"
              stroke="#fff0f9"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}
    </>
  );
}
