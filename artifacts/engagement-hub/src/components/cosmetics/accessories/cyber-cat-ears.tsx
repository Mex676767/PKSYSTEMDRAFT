import type { CosmeticRenderProps } from "../geometry";

function Ear({ x, glowId, mirror }: { x: number; glowId: string; mirror?: boolean }) {
  return (
    <g transform={`translate(${x} 20) scale(${mirror ? -1 : 1} 1)`}>
      <path d="M 0 14 L -8 -6 L 6 4 Z" fill="#1e1b2e" stroke="#f472b6" strokeWidth={0.8} filter={`url(#${glowId})`} />
      <path d="M 0 10 L -4.5 -1 L 3 3.4 Z" fill="#a21caf" opacity={0.85} />
    </g>
  );
}

export function CyberCatEarsAccessory({ uid, animated }: CosmeticRenderProps) {
  const glowId = `cce-glow-${uid}`;
  return (
    <>
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-pulse 2.2s ease-in-out infinite" } : undefined}
      >
        <Ear x={34} glowId={glowId} />
      </g>
      <g
        className={animated ? "cosmetic-anim" : undefined}
        style={animated ? { animation: "cosmetic-pulse 2.2s ease-in-out infinite 0.3s" } : undefined}
      >
        <Ear x={66} glowId={glowId} mirror />
      </g>

      <line x1={20} y1={54} x2={38} y2={52} stroke="#f0abfc" strokeWidth={0.4} opacity={0.7} />
      <line x1={20} y1={58} x2={38} y2={58} stroke="#f0abfc" strokeWidth={0.4} opacity={0.7} />
      <line x1={80} y1={54} x2={62} y2={52} stroke="#f0abfc" strokeWidth={0.4} opacity={0.7} />
      <line x1={80} y1={58} x2={62} y2={58} stroke="#f0abfc" strokeWidth={0.4} opacity={0.7} />
    </>
  );
}
