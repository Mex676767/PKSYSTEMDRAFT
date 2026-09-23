import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

const BLOCK_ANGLES = Array.from({ length: 22 }, (_, i) => i * (360 / 22));

export function PixelGlitchBorder({ uid, animated }: CosmeticRenderProps) {
  return (
    <>
      {BLOCK_ANGLES.map((angle, i) => {
        const r = 30 + ((i * 7) % 9);
        const pos = polar(50, 50, r, angle);
        const size = 2 + (i % 3);
        const color = i % 3 === 0 ? "#ff5fd1" : i % 3 === 1 ? "#22d3ee" : "#c084fc";
        return (
          <rect
            key={i}
            x={pos.x - size / 2}
            y={pos.y - size / 2}
            width={size}
            height={size}
            fill={color}
            opacity={0.85}
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? { animation: `cosmetic-flicker ${2.2 + (i % 5) * 0.3}s steps(1) infinite`, animationDelay: `${(i % 7) * 0.15}s` }
                : undefined
            }
          />
        );
      })}

      {/* RGB-split ghost ring: two offset thin circles that flicker to read as a glitch artifact */}
      <circle
        cx={50.9}
        cy={49.6}
        r={34}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={0.8}
        opacity={0.5}
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-flicker 3.4s steps(1) infinite" } : undefined}
      />
      <circle
        cx={49.2}
        cy={50.5}
        r={34}
        fill="none"
        stroke="#ff5fd1"
        strokeWidth={0.8}
        opacity={0.5}
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-flicker 2.8s steps(1) infinite 0.4s" } : undefined}
      />
      <circle cx={50} cy={50} r={34} fill="none" stroke="#f5f5ff" strokeWidth={0.5} opacity={0.35} />
    </>
  );
}
