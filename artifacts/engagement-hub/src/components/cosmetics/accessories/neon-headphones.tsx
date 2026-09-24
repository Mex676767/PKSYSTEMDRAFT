import type { CosmeticRenderProps } from "../geometry";
import { Glow, bob } from "../details";

export function NeonHeadphonesAccessory({
  uid,
  animated,
}: CosmeticRenderProps) {
  const neon = `nh-neon-${uid}`,
    glow = `nh-glow-${uid}`,
    cup = `nh-cup-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={neon}>
          <stop stopColor="#fc25e6" />
          <stop offset=".55" stopColor="#ce4dff" />
          <stop offset="1" stopColor="#30eaff" />
        </linearGradient>
        <linearGradient id={cup}>
          <stop stopColor="#211237" />
          <stop offset=".5" stopColor="#803bd4" />
          <stop offset="1" stopColor="#211237" />
        </linearGradient>
        <Glow id={glow} />
      </defs>
      <path
        d="M-4 48 C-12 -28 112 -28 104 48"
        fill="none"
        stroke="#211329"
        strokeWidth="10"
      />
      <path
        d="M-4 45 C-12 -28 112 -28 104 45"
        fill="none"
        stroke={`url(#${neon})`}
        strokeWidth="4"
        filter={`url(#${glow})`}
      />
      <path
        d="M0 30 C5 -11 95 -11 100 30"
        fill="none"
        stroke="#493065"
        strokeWidth="3"
      />
      {[0, 100].map((x, i) => (
        <g key={x} transform={`translate(${x} 49) rotate(${i ? 8 : -8})`}>
          <rect
            x="-11"
            y="-23"
            width="22"
            height="44"
            rx="11"
            fill={`url(#${cup})`}
            stroke="#e262ff"
            strokeWidth="1.4"
          />
          <ellipse
            cx={i ? 3 : -3}
            cy="-1"
            rx="7.5"
            ry="16"
            fill="#381354"
            stroke="#4ff4ff"
            strokeWidth="2.8"
            filter={`url(#${glow})`}
          />
          <ellipse cx={i ? 3 : -3} cy="-1" rx="4.6" ry="12" fill="#c937ed" />
          <path
            d="M-2 -11 V7 M2 -8 V10"
            stroke="#fee5ff"
            opacity=".7"
            strokeWidth="1.2"
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? { animation: "cosmetic-pulse 1.7s ease-in-out infinite" }
                : undefined
            }
          />
        </g>
      ))}
      {[
        [-28, 4, "#fc70ee"],
        [126, 7, "#42efff"],
        [133, 65, "#f777ed"],
      ].map(([x, y, color], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={bob(animated, -i)}
          >
            <path
              d="M0 9 V-7 L9 -10 V5 M0 -4 L9 -7"
              fill="none"
              stroke={String(color)}
              strokeWidth="2"
              filter={`url(#${glow})`}
            />
            <ellipse cx="-2.5" cy="10" rx="3.8" ry="2.8" fill={String(color)} />
            <ellipse cx="6.5" cy="6" rx="3.8" ry="2.8" fill={String(color)} />
          </g>
        </g>
      ))}
    </>
  );
}
