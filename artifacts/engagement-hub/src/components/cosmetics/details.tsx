import type { CSSProperties } from "react";

export function Glow({ id, blur = 1.5 }: { id: string; blur?: number }) {
  return (
    <filter
      id={id}
      x="-80%"
      y="-80%"
      width="260%"
      height="260%"
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur stdDeviation={blur} result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

export const STAR =
  "M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z";

export function Sparkles({
  animated,
  color = "#ffe6a8",
  points,
}: {
  animated: boolean;
  color?: string;
  points: readonly (readonly [number, number, number?])[];
}) {
  return (
    <>
      {points.map(([x, y, scale = 1], i) => (
        // The outer group owns placement. Animation never replaces its transform.
        <g key={i} transform={`translate(${x} ${y}) scale(${scale})`}>
          <path
            d={STAR}
            fill={color}
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? {
                    animation: `cosmetic-twinkle ${2.4 + i * 0.3}s ease-in-out infinite ${-i * 0.7}s`,
                    transformOrigin: "0 0",
                  }
                : undefined
            }
          />
        </g>
      ))}
    </>
  );
}

export function bob(animated: boolean, delay = 0): CSSProperties | undefined {
  return animated
    ? { animation: `cosmetic-bob 3.4s ease-in-out infinite ${delay}s` }
    : undefined;
}
