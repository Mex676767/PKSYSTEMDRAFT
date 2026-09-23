import type { CosmeticRenderProps } from "../geometry";
import { polar } from "../geometry";

function Leaf({ angle, gradId }: { angle: number; gradId: string }) {
  const pos = polar(50, 50, 35, angle);
  return (
    <ellipse
      cx={pos.x}
      cy={pos.y}
      rx={1.3}
      ry={2.5}
      fill={`url(#${gradId})`}
      transform={`rotate(${angle + 90} ${pos.x} ${pos.y})`}
      opacity={0.95}
    />
  );
}

const LEFT_ANGLES = Array.from({ length: 11 }, (_, i) => 90 + i * (170 / 10));
const RIGHT_ANGLES = Array.from({ length: 11 }, (_, i) => 90 - i * (170 / 10));

export function ChampionLaurelAccessory({ uid, animated }: CosmeticRenderProps) {
  const leafGrad = `cl-leaf-${uid}`;
  const shineGrad = `cl-shine-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={leafGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="55%" stopColor="#ffd75e" />
          <stop offset="100%" stopColor="#c9891a" />
        </linearGradient>
        <linearGradient id={shineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="50%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          {animated && <animate attributeName="x1" values="-30%;130%" dur="3s" repeatCount="indefinite" />}
          {animated && <animate attributeName="x2" values="70%;230%" dur="3s" repeatCount="indefinite" />}
        </linearGradient>
        <mask id={`cl-mask-${uid}`}>
          {LEFT_ANGLES.map((a, i) => {
            const pos = polar(50, 50, 35, a);
            return <circle key={`l${i}`} cx={pos.x} cy={pos.y} r={2.6} fill="#fff" />;
          })}
          {RIGHT_ANGLES.map((a, i) => {
            const pos = polar(50, 50, 35, a);
            return <circle key={`r${i}`} cx={pos.x} cy={pos.y} r={2.6} fill="#fff" />;
          })}
        </mask>
      </defs>

      {LEFT_ANGLES.map((a, i) => (
        <Leaf key={`l${i}`} angle={a} gradId={leafGrad} />
      ))}
      {RIGHT_ANGLES.map((a, i) => (
        <Leaf key={`r${i}`} angle={a} gradId={leafGrad} />
      ))}

      <rect x={0} y={0} width={100} height={100} fill={`url(#${shineGrad})`} mask={`url(#cl-mask-${uid})`} />
    </>
  );
}
