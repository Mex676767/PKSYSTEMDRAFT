import type { CosmeticRenderProps } from "../geometry";

function Wing({ uid, mirror }: { uid: string; mirror?: boolean }) {
  const gradId = `aw-wing-${uid}`;
  const path =
    "M 0 0 C -14 -6 -22 2 -24 14 C -19 10 -15 12 -18 18 C -13 15 -10 17 -12 22 C -7 19 -3 20 -4 24 C 2 20 6 12 4 2 Z";
  return (
    <g transform={`translate(${mirror ? 78 : 22} 46) scale(${mirror ? -1 : 1} 1)`} style={{ transformOrigin: mirror ? "78px 46px" : "22px 46px" }}>
      <path d={path} fill={`url(#${gradId})`} stroke="#fef3c7" strokeWidth={0.3} opacity={0.95} />
    </g>
  );
}

export function AngelWingsAccessory({ uid, animated }: CosmeticRenderProps) {
  const gradId = `aw-wing-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#fef9e7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <ellipse cx={50} cy={15} rx={11} ry={3} fill="none" stroke="#fbbf24" strokeWidth={1.4} opacity={0.85} />

      <g
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-flap 2.6s ease-in-out infinite", transformOrigin: "22px 46px" } : undefined}
      >
        <Wing uid={uid} />
      </g>
      <g
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-flap 2.6s ease-in-out infinite 0.15s", transformOrigin: "78px 46px" } : undefined}
      >
        <Wing uid={uid} mirror />
      </g>
    </>
  );
}
