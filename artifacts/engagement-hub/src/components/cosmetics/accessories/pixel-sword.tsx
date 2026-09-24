import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles } from "../details";

export function PixelSwordAccessory({ uid, animated }: CosmeticRenderProps) {
  const blade = `ps-blade-${uid}`,
    glow = `ps-glow-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={blade} x2="0" y2="1">
          <stop stopColor="#48f4ff" />
          <stop offset=".5" stopColor="#7195ff" />
          <stop offset="1" stopColor="#ea54fc" />
        </linearGradient>
        <Glow id={glow} blur={1.2} />
      </defs>
      <g transform="translate(93 53) rotate(37)">
        <path
          d="M-4 -78 H4 V-70 H9 V-11 H4 V-3 H-4 V-11 H-9 V-70 H-4Z"
          fill={`url(#${blade})`}
          stroke="#a1fbff"
          strokeWidth="1.2"
          filter={`url(#${glow})`}
        />
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d={`M-8 ${-68 + i * 7} H8 M0 ${-68 + i * 7} V${-61 + i * 7}`}
            stroke={i % 2 ? "#e59bff" : "#78f3ff"}
            strokeWidth="1"
          />
        ))}
        <path
          d="M-20 -9 H-12 V-4 H12 V-9 H20 V3 H8 V8 H-8 V3 H-20Z"
          fill="#f29d4b"
          stroke="#ffdb9b"
          strokeWidth="1.2"
        />
        <path
          d="M-4 8 H4 V29 H9 V37 H-9 V29 H-4Z"
          fill="#822bc7"
          stroke="#f67dff"
          strokeWidth="1.3"
        />
        <path
          d="M-3 14 H4 M-3 20 H4 M-6 31 H6"
          stroke="#ec7bfb"
          strokeWidth="2"
        />
      </g>
      <Sparkles
        animated={animated}
        color="#83f6ff"
        points={[
          [126, 37, 0.65],
          [104, -31, 0.65],
          [125, 84, 0.6],
        ]}
      />
    </>
  );
}
