import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles, bob } from "../details";

export function MiniPlanetAccessory({ uid, animated }: CosmeticRenderProps) {
  const planet = `mp-planet-${uid}`,
    moon = `mp-moon-${uid}`,
    glow = `mp-glow-${uid}`,
    clip = `mp-clip-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={planet} x2=".8" y2="1">
          <stop stopColor="#ffe899" />
          <stop offset=".3" stopColor="#f88c7e" />
          <stop offset=".7" stopColor="#be4aed" />
          <stop offset="1" stopColor="#4821b1" />
        </linearGradient>
        <linearGradient id={moon} x2=".8" y2="1">
          <stop stopColor="#66faff" />
          <stop offset=".5" stopColor="#9071ff" />
          <stop offset="1" stopColor="#f16bca" />
        </linearGradient>
        <clipPath id={clip}>
          <circle r="21" />
        </clipPath>
        <Glow id={glow} blur={1} />
      </defs>
      <g transform="translate(50 -27) rotate(-18)">
        <g
          className={animated ? "cosmetic-anim" : undefined}
          style={bob(animated)}
        >
          <ellipse
            rx="38"
            ry="10"
            fill="none"
            stroke="#bf5fff"
            strokeWidth="3.5"
            filter={`url(#${glow})`}
          />
          <circle
            r="21"
            fill={`url(#${planet})`}
            stroke="#dea5ff"
            strokeWidth="1"
          />
          <g
            clipPath={`url(#${clip})`}
            fill="none"
            stroke="#ffc996"
            strokeWidth="3"
            opacity=".7"
          >
            <path d="M-24 -10 Q0 3 24 -10 M-24 0 Q0 13 24 0 M-24 12 Q0 23 24 12" />
          </g>
          <path
            d="M-38 0 A38 10 0 0 0 38 0"
            fill="none"
            stroke="#e37aff"
            strokeWidth="4"
            filter={`url(#${glow})`}
          />
          <path
            d="M-38 0 A38 10 0 0 0 18 9"
            fill="none"
            stroke="#63f6ff"
            strokeWidth="1.8"
          />
        </g>
      </g>
      {[
        [-18, 18, 8],
        [116, 26, 9],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={bob(animated, -i - 1)}
          >
            <circle
              r={r}
              fill={`url(#${moon})`}
              stroke="#92d9ff"
              strokeWidth=".8"
            />
            <path
              d={`M${-r * 0.8} -3 Q0 3 ${r * 0.8} 2`}
              fill="none"
              stroke="#bdfaff"
              strokeWidth="1"
            />
          </g>
        </g>
      ))}
      <Sparkles
        animated={animated}
        points={[
          [100, -17, 0.7],
          [-19, 78, 0.8],
          [119, 74, 0.8],
        ]}
      />
    </>
  );
}
