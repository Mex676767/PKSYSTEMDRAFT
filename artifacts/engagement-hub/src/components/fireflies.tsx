import { useMemo } from "react";

const FIREFLY_COLORS = ["#ec4899", "#fb923c", "#a855f7", "#22d3ee", "#facc15"];
const FIREFLY_COUNT = 22;

type Firefly = {
  id: number;
  left: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
};

export function Fireflies() {
  const fireflies = useMemo<Firefly[]>(
    () =>
      Array.from({ length: FIREFLY_COUNT }, (_, id) => ({
        id,
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        color: FIREFLY_COLORS[Math.floor(Math.random() * FIREFLY_COLORS.length)],
        duration: 10 + Math.random() * 14,
        delay: Math.random() * 14,
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="firefly"
          style={{
            left: `${f.left}vw`,
            width: f.size,
            height: f.size,
            backgroundColor: f.color,
            boxShadow: `0 0 ${f.size * 2}px ${f.color}`,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
