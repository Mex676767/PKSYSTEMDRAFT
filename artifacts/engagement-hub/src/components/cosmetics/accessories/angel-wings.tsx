import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles } from "../details";

export function AngelWingsAccessory({
  uid,
  animated,
  layer = "front",
}: CosmeticRenderProps) {
  const feather = `aw-feather-${uid}`,
    glow = `aw-glow-${uid}`;
  if (layer === "front")
    return (
      <>
        <defs>
          <Glow id={glow} />
        </defs>
        <ellipse
          cx="50"
          cy="-22"
          rx="29"
          ry="7"
          fill="none"
          stroke="#ff9b38"
          strokeWidth="5"
          filter={`url(#${glow})`}
        />
        <ellipse
          cx="50"
          cy="-23"
          rx="28"
          ry="5.5"
          fill="none"
          stroke="#fff5b9"
          strokeWidth="1.8"
        />
        <Sparkles
          animated={animated}
          color="#ffd9ff"
          points={[
            [-30, 8, 0.8],
            [126, 10, 0.8],
            [-37, 83, 0.55],
            [139, 79, 0.6],
          ]}
        />
      </>
    );
  return (
    <>
      <defs>
        <linearGradient id={feather} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#d5c7ff" />
          <stop offset=".38" stopColor="#fff6ff" />
          <stop offset=".72" stopColor="#ffc3ec" />
          <stop offset="1" stopColor="#ffdb8b" />
        </linearGradient>
        <Glow id={glow} blur={2} />
      </defs>
      {[false, true].map((mirror) => (
        <g
          key={String(mirror)}
          transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}
        >
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? {
                    animation: "cosmetic-wing 3s ease-in-out infinite",
                    transformOrigin: "9px 73px",
                  }
                : undefined
            }
          >
            {[
              "M11 54 C-8 47 -23 33 -36 11 C-41 3 -45 11 -41 28 C-34 48 -15 62 10 66Z",
              "M11 63 C-15 57 -28 42 -42 33 C-51 26 -48 43 -39 53 C-25 67 -9 71 12 73Z",
              "M12 71 C-13 67 -26 59 -39 54 C-50 51 -43 64 -30 72 C-16 80 -1 80 12 79Z",
              "M12 78 C-5 75 -19 72 -29 72 C-43 72 -25 86 -12 85 Q1 87 12 82Z",
            ].map((d, i) => (
              <path
                key={i}
                d={d}
                fill={`url(#${feather})`}
                stroke="#f7e3ff"
                strokeWidth="1.4"
                strokeLinejoin="round"
                filter={`url(#${glow})`}
              />
            ))}
          </g>
        </g>
      ))}
    </>
  );
}
