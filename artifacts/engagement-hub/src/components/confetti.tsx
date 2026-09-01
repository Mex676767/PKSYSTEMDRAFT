import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; color: string; delay: number; duration: number }[]>([]);

  useEffect(() => {
    if (active) {
      const colors = ['#6366f1', '#ec4899', '#eab308', '#14b8a6', '#f43f5e'];
      const newPieces = Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // percentage
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
      }));
      setPieces(newPieces);
      
      const timer = setTimeout(() => {
        setPieces([]);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setPieces([]);
      return;
    }
  }, [active]);

  if (!active || pieces.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece rounded-sm"
          style={{
            left: `${p.x}vw`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>,
    document.body
  );
}