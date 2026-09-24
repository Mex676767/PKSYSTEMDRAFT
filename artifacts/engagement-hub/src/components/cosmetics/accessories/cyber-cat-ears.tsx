import type { CosmeticRenderProps } from "../geometry";
import { Glow } from "../details";

export function CyberCatEarsAccessory({ uid, animated }: CosmeticRenderProps) {
  const glow = `cat-glow-${uid}`;
  return (
    <>
      <defs>
        <Glow id={glow} />
      </defs>
      <path
        d="M-6 33 Q-2 -11 50 -6 Q102 -11 106 33"
        fill="none"
        stroke="#29132f"
        strokeWidth="8"
      />
      <path
        d="M-6 29 Q0 -9 50 -5 Q100 -9 106 29"
        fill="none"
        stroke="#d743f4"
        strokeWidth="1.7"
      />
      {[false, true].map((right) => (
        <g
          key={String(right)}
          transform={right ? "translate(100 0) scale(-1 1)" : undefined}
        >
          <path
            d="M-1 6 Q-12 -25 -5 -34 Q4 -39 30 -13Z"
            fill="#2b0d49"
            stroke="#ff59e8"
            strokeWidth="3"
            strokeLinejoin="round"
            filter={`url(#${glow})`}
          />
          <path
            d="M2 -3 L0 -26 L20 -13Z"
            fill="#55258f"
            stroke="#57f5ff"
            strokeWidth="2.5"
          />
          <path d="M5 -9 L5 -18 L13 -13Z" fill="#d6fbff" />
          <g
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? { animation: "cosmetic-pulse 2.6s ease-in-out infinite" }
                : undefined
            }
          >
            <path
              d="M-12 50 L-32 45 M-12 59 H-35 M-12 68 L-30 75"
              stroke="#ff9bec"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter={`url(#${glow})`}
            />
          </g>
        </g>
      ))}
    </>
  );
}
