import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles } from "../details";

const LEAVES = [
  [-9, 48, -68],
  [-16, 36, -68],
  [-16, 20, -42],
  [-9, 5, -24],
  [1, -8, -9],
  [14, -17, 10],
  [27, -22, 26],
  [-5, 36, 17],
  [-3, 21, 31],
  [4, 9, 44],
  [16, -2, 52],
] as const;
export function ChampionLaurelAccessory({
  uid,
  animated,
}: CosmeticRenderProps) {
  const gold = `cl-gold-${uid}`,
    glow = `cl-glow-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={gold}>
          <stop stopColor="#fff3ab" />
          <stop offset=".4" stopColor="#ffdd58" />
          <stop offset=".75" stopColor="#ef9c20" />
          <stop offset="1" stopColor="#af4e0c" />
        </linearGradient>
        <Glow id={glow} blur={0.8} />
      </defs>
      {[false, true].map((right) => (
        <g
          key={String(right)}
          transform={right ? "translate(100 0) scale(-1 1)" : undefined}
        >
          <path
            d="M5 57 C-23 20 -4 -10 33 -25"
            fill="none"
            stroke="#ffd85a"
            strokeWidth="2"
          />
          <g filter={`url(#${glow})`}>
            {LEAVES.map(([x, y, angle], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}>
                <path
                  d="M0 6 C-10 -1 -7 -10 0 -13 C7 -6 7 1 0 6Z"
                  fill={`url(#${gold})`}
                  stroke="#ffe491"
                  strokeWidth=".7"
                />
                <path
                  d="M0 4 V-10"
                  stroke="#fff1b2"
                  strokeWidth=".6"
                  opacity=".7"
                />
              </g>
            ))}
          </g>
        </g>
      ))}
      <Sparkles
        animated={animated}
        points={[
          [-32, 2, 0.7],
          [128, -1, 0.6],
          [-28, 70, 0.65],
          [130, 69, 0.65],
        ]}
      />
    </>
  );
}
