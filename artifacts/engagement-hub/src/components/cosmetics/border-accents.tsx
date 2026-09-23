import type { BorderKey } from "@/lib/cosmetics";
import { Sparkles, bob } from "./details";
import { polar } from "./geometry";

/** Small moving highlights over the original ring art, keyed to the reference
 * demo's eight effects. Every position is relative to the same photo opening.
 */
export function BorderAccents({
  border,
  animated,
}: {
  border: BorderKey;
  animated: boolean;
}) {
  const orbit = animated ? "cosmetic-anim cosmetic-orbit" : undefined;
  const origin = { transformOrigin: "50px 50px" };
  switch (border) {
    case "cosmic-orbit":
      return (
        <g className={orbit} style={origin}>
          <circle cx="50" cy="-7" r="1.8" fill="#ffd36d" />
          <circle cx="103" cy="71" r="1.4" fill="#56edff" />
          <circle cx="1" cy="79" r="1" fill="#ffe596" />
        </g>
      );
    case "pixel-glitch":
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => {
            const p = polar(50, 50, 57, i * 45);
            return (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={i % 2 ? 3 : 2}
                height="1.7"
                fill={i % 2 ? "#f765fd" : "#4cf3ff"}
                className={animated ? "cosmetic-anim" : undefined}
                style={
                  animated
                    ? {
                        animation: `cosmetic-flicker 2.6s steps(1) infinite ${-i * 0.4}s`,
                      }
                    : undefined
                }
              />
            );
          })}
        </>
      );
    case "electric-pulse":
      return (
        <circle
          cx="50"
          cy="50"
          r="53"
          fill="none"
          stroke="#86f6ff"
          strokeWidth=".9"
          strokeDasharray="9 102"
          className={orbit}
          style={{ ...origin, animationDuration: "4s" }}
        />
      );
    case "sakura-bloom":
      return (
        <>
          {[-35, 40, 135, 205].map((a, i) => {
            const p = polar(50, 50, 64, a);
            return (
              <g key={a} transform={`translate(${p.x} ${p.y}) rotate(${a})`}>
                <ellipse
                  rx="1.2"
                  ry="2.7"
                  fill="#ffb4e5"
                  className={animated ? "cosmetic-anim" : undefined}
                  style={bob(animated, -i)}
                />
              </g>
            );
          })}
        </>
      );
    case "trophy-halo":
      return (
        <Sparkles
          animated={animated}
          color="#fff2b5"
          points={[
            [50, -18, 0.4],
            [-12, 35, 0.35],
            [109, 81, 0.35],
          ]}
        />
      );
    case "crystal-prism":
      return (
        <Sparkles
          animated={animated}
          color="#d6ffff"
          points={[
            [50, -21, 0.35],
            [-13, 56, 0.4],
            [113, 47, 0.4],
            [55, 113, 0.3],
          ]}
        />
      );
    case "meteor-trail":
      return (
        <g className={orbit} style={{ ...origin, animationDuration: "7s" }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const p = polar(50, 50, 55, -90 - i * 4);
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={1.7 - i * 0.22}
                fill={i ? "#ff788f" : "#fff0b0"}
                opacity={1 - i * 0.16}
              />
            );
          })}
        </g>
      );
    case "galaxy-crown":
      return (
        <Sparkles
          animated={animated}
          color="#d6afff"
          points={[
            [50, -23, 0.35],
            [-24, 38, 0.45],
            [122, 61, 0.45],
            [73, 111, 0.3],
          ]}
        />
      );
  }
}
