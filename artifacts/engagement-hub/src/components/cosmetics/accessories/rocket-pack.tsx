import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles } from "../details";

export function RocketPackAccessory({ uid, animated }: CosmeticRenderProps) {
  const body = `rp-body-${uid}`,
    flame = `rp-flame-${uid}`,
    glow = `rp-glow-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={body} x2="0" y2="1">
          <stop stopColor="#f4f7ff" />
          <stop offset=".55" stopColor="#c7d2e8" />
          <stop offset="1" stopColor="#7c8aa8" />
        </linearGradient>
        <linearGradient id={flame} x2="0" y2="1">
          <stop stopColor="#fff3b0" />
          <stop offset=".5" stopColor="#ff8b3d" />
          <stop offset="1" stopColor="#ff3d3d" stopOpacity="0" />
        </linearGradient>
        <Glow id={glow} blur={1.4} />
      </defs>
      <g transform="translate(108 59) rotate(24)">
        <g
          className={animated ? "cosmetic-anim" : undefined}
          style={
            animated
              ? { animation: "cosmetic-thrust .5s ease-in-out infinite", transformOrigin: "0px 28px" }
              : undefined
          }
        >
          <path
            d="M-7 28 C-7 44 7 44 7 28 L4 55 L-4 55Z"
            fill={`url(#${flame})`}
            filter={`url(#${glow})`}
          />
        </g>
        <rect x="-9" y="-26" width="18" height="54" rx="9" fill={`url(#${body})`} stroke="#5b6b8c" strokeWidth="1.2" />
        <path d="M-9 -26 Q0 -42 9 -26Z" fill="#ff5d5d" stroke="#ffb3b3" strokeWidth="1" />
        <circle cx="0" cy="-8" r="5" fill="#57d2ff" stroke="#0c4a6e" strokeWidth="1" filter={`url(#${glow})`} />
        <path d="M-9 16 L-20 30 L-9 30Z" fill="#dbe3f5" stroke="#5b6b8c" strokeWidth="1" />
        <path d="M9 16 L20 30 L9 30Z" fill="#dbe3f5" stroke="#5b6b8c" strokeWidth="1" />
      </g>
      <Sparkles
        animated={animated}
        color="#ffe6a8"
        points={[
          [30, 20, 0.7],
          [113, -10, 0.6],
          [118, 88, 0.55],
        ]}
      />
    </>
  );
}
