import type { CosmeticRenderProps } from "../geometry";
import { Glow, Sparkles, STAR } from "../details";

export function WizardHatAccessory({ uid, animated }: CosmeticRenderProps) {
  const cloth = `wh-cloth-${uid}`,
    brim = `wh-brim-${uid}`,
    glow = `wh-glow-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={cloth}>
          <stop stopColor="#21052f" />
          <stop offset=".5" stopColor="#6b1bad" />
          <stop offset="1" stopColor="#270747" />
        </linearGradient>
        <linearGradient id={brim} x2="0" y2="1">
          <stop stopColor="#a52ce3" />
          <stop offset=".45" stopColor="#431263" />
          <stop offset="1" stopColor="#170721" />
        </linearGradient>
        <Glow id={glow} blur={1} />
      </defs>
      <g transform="rotate(-12 50 4)">
        <ellipse
          cx="50"
          cy="8"
          rx="70"
          ry="14"
          fill={`url(#${brim})`}
          stroke="#bf53ef"
          strokeWidth="1.5"
        />
        <path
          d="M5 5 Q27 -27 20 -55 Q8 -68 -6 -45 Q-1 -86 23 -72 Q45 -62 87 5Z"
          fill={`url(#${cloth})`}
          stroke="#b249d9"
          strokeWidth="1.3"
        />
        <path
          d="M8 3 Q43 -8 85 2"
          fill="none"
          stroke="#ba54f8"
          strokeWidth="4"
        />
        <path
          d="M13 0 Q45 -8 80 0"
          fill="none"
          stroke="#ffd374"
          strokeWidth="1.2"
        />
        <path
          d="M57 -47 A12 12 0 1 0 65 -27 A11 11 0 0 1 57 -47"
          fill="#ffd667"
          filter={`url(#${glow})`}
        />
        <path d={STAR} transform="translate(30 -24) scale(.9)" fill="#ffe394" />
        <path
          d={STAR}
          transform="translate(24 -62) scale(.45)"
          fill="#ffe394"
        />
        <path
          d={STAR}
          transform="translate(72 -11) scale(.45)"
          fill="#ffe394"
        />
        <circle cx="37" cy="-44" r="1.1" fill="#d477ff" />
        <circle cx="46" cy="-17" r="1.4" fill="#e79aff" />
        <path
          d="M-17 9 Q48 -9 118 9"
          fill="none"
          stroke="#d570fa"
          strokeWidth="1.5"
        />
      </g>
      <Sparkles
        animated={animated}
        points={[
          [-21, -20, 0.9],
          [116, -5, 0.8],
          [-9, 39, 0.6],
        ]}
      />
    </>
  );
}
