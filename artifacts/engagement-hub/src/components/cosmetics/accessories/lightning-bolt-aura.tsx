import type { CosmeticRenderProps } from "../geometry";
import { Glow } from "../details";

const BOLTS = [
  [-24, -18, -0.22, 1],
  [121, 12, 0.3, 1.1],
  [-28, 66, -0.4, 0.8],
  [117, 91, 0.15, 0.55],
  [49, -32, -1.1, 0.75],
] as const;

export function LightningBoltAuraAccessory({
  uid,
  animated,
}: CosmeticRenderProps) {
  const color = `lb-color-${uid}`,
    glow = `lb-glow-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={color} x2=".4" y2="1">
          <stop stopColor="#ff6ade" />
          <stop offset=".43" stopColor="#fff289" />
          <stop offset="1" stopColor="#ff942e" />
        </linearGradient>
        <Glow id={glow} blur={2} />
      </defs>
      {BOLTS.map(([x, y, angle, scale], i) => (
        <g
          key={i}
          transform={`translate(${x} ${y}) rotate(${angle * 90}) scale(${scale})`}
        >
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? {
                    animation: `cosmetic-flicker 2.8s steps(1) infinite ${-i * 0.5}s`,
                  }
                : undefined
            }
          >
            <path
              d="M-4 -20 L12 2 L2 5 L13 30 L-12 3 L-2 0Z"
              fill={`url(#${color})`}
              stroke="#ffe5a3"
              strokeWidth="1.1"
              filter={`url(#${glow})`}
            />
          </g>
        </g>
      ))}
    </>
  );
}
