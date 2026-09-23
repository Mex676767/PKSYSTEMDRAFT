import type { CosmeticRenderProps } from "../geometry";

/** Each cell: [col, row, color]. Grid is 5 wide, drawn as 2x2 px blocks for a pixel-art look. */
const BLADE_COLOR = "#e2e8f0";
const EDGE_COLOR = "#94a3b8";
const HILT_COLOR = "#78350f";
const GUARD_COLOR = "#fbbf24";

const CELLS: [number, number, string][] = [
  [2, 0, BLADE_COLOR],
  [1, 1, EDGE_COLOR], [2, 1, BLADE_COLOR], [3, 1, BLADE_COLOR],
  [1, 2, BLADE_COLOR], [2, 2, BLADE_COLOR], [3, 2, EDGE_COLOR],
  [1, 3, EDGE_COLOR], [2, 3, BLADE_COLOR], [3, 3, BLADE_COLOR],
  [1, 4, BLADE_COLOR], [2, 4, BLADE_COLOR], [3, 4, EDGE_COLOR],
  [1, 5, EDGE_COLOR], [2, 5, BLADE_COLOR], [3, 5, BLADE_COLOR],
  [0, 6, GUARD_COLOR], [1, 6, GUARD_COLOR], [2, 6, GUARD_COLOR], [3, 6, GUARD_COLOR], [4, 6, GUARD_COLOR],
  [2, 7, HILT_COLOR],
  [2, 8, HILT_COLOR],
  [1, 9, HILT_COLOR], [2, 9, HILT_COLOR], [3, 9, HILT_COLOR],
];

const CELL = 2.6;

export function PixelSwordAccessory({ uid, animated }: CosmeticRenderProps) {
  const shineId = `ps-shine-${uid}`;
  const maskId = `ps-mask-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={shineId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="52%" stopColor="#ffffff" stopOpacity={0.85} />
          <stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          {animated && (
            <animate attributeName="x1" values="-40%;140%" dur="2.6s" repeatCount="indefinite" />
          )}
          {animated && (
            <animate attributeName="x2" values="60%;240%" dur="2.6s" repeatCount="indefinite" />
          )}
        </linearGradient>
        <mask id={maskId}>
          {CELLS.map(([c, r], i) => (
            <rect key={i} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="#fff" />
          ))}
        </mask>
      </defs>

      <g transform="translate(74 66) rotate(-38)">
        <g transform={`translate(${-2.5 * CELL} ${-5 * CELL})`}>
          {CELLS.map(([c, r, color], i) => (
            <rect key={i} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={color} />
          ))}
          <rect x={0} y={0} width={5 * CELL} height={10 * CELL} fill={`url(#${shineId})`} mask={`url(#${maskId})`} />
        </g>
      </g>
    </>
  );
}
