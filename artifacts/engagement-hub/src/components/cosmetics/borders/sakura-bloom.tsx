import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

function Flower({ x, y, scale = 1, uid, index }: { x: number; y: number; scale?: number; uid: string; index: number }) {
  const petalGrad = `sk-petal-${uid}-${index}`;
  const petalOffsets = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <defs>
        <radialGradient id={petalGrad} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff1f6" />
          <stop offset="100%" stopColor="#fbcfe8" />
        </radialGradient>
      </defs>
      {petalOffsets.map((deg) => (
        <ellipse key={deg} cx={0} cy={-1.6} rx={1.05} ry={1.7} fill={`url(#${petalGrad})`} transform={`rotate(${deg})`} opacity={0.95} />
      ))}
      <circle cx={0} cy={0} r={0.7} fill="#fbbf24" />
    </g>
  );
}

const FLOWER_ANGLES = [0, 55, 110, 180, 235, 300];
const PETAL_FALL = [
  { start: 15, r: 44 },
  { start: 100, r: 47 },
  { start: 190, r: 45 },
  { start: 260, r: 48 },
  { start: 330, r: 46 },
];

export function SakuraBloomBorder({ uid, animated }: CosmeticRenderProps) {
  return (
    <>
      <circle cx={50} cy={50} r={33} fill="none" stroke="#fbcfe8" strokeWidth={1.4} opacity={0.75} />

      {FLOWER_ANGLES.map((angle, i) => {
        const pos = polar(50, 50, 33, angle);
        return <Flower key={i} x={pos.x} y={pos.y} scale={i % 2 === 0 ? 1.1 : 0.85} uid={uid} index={i} />;
      })}

      {PETAL_FALL.map((p, i) => {
        const pos = polar(50, 50, p.r, p.start);
        return (
          <ellipse
            key={i}
            cx={pos.x}
            cy={pos.y}
            rx={1}
            ry={1.6}
            fill="#f9a8d4"
            opacity={0.8}
            className={animated ? "cosmetic-anim" : undefined}
            style={
              animated
                ? { animation: `cosmetic-float-y ${3.5 + i * 0.4}s ease-in-out infinite ${i * 0.5}s`, transformOrigin: `${pos.x}px ${pos.y}px` }
                : undefined
            }
          />
        );
      })}
    </>
  );
}
