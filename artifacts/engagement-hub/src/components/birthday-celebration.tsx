import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfettiPiece = { id: number; x: number; color: string; duration: number };
type Sparkle = { id: number; x: number; duration: number; emoji: string; size: number };

const CONFETTI_COLORS = ["#e879f9", "#f472b6", "#fbbf24", "#c084fc", "#fb7185"];
const SPARKLE_EMOJIS = ["🎉", "✨", "🎊", "⭐", "🎈"];

export function BirthdayCelebration({ active }: { active: boolean }) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    if (!active) {
      setConfetti([]);
      setSparkles([]);
      return;
    }

    let confettiId = 0;
    let sparkleId = 0;

    const confettiInterval = setInterval(() => {
      setConfetti((prev) => [
        ...prev.slice(-60),
        ...Array.from({ length: 4 }, () => ({
          id: confettiId++,
          x: Math.random() * 100,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          duration: 3 + Math.random() * 2,
        })),
      ]);
    }, 600);

    const sparkleInterval = setInterval(() => {
      setSparkles((prev) => [
        ...prev.slice(-30),
        ...Array.from({ length: 2 }, () => ({
          id: sparkleId++,
          x: Math.random() * 100,
          duration: 3.5 + Math.random() * 2,
          emoji: SPARKLE_EMOJIS[Math.floor(Math.random() * SPARKLE_EMOJIS.length)],
          size: 14 + Math.random() * 14,
        })),
      ]);
    }, 550);

    return () => {
      clearInterval(confettiInterval);
      clearInterval(sparkleInterval);
    };
  }, [active]);

  if (!active) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {confetti.map((p) => (
        <div
          key={`c-${p.id}`}
          className="confetti-piece rounded-sm"
          style={{ left: `${p.x}vw`, backgroundColor: p.color, animationDuration: `${p.duration}s` }}
          onAnimationEnd={() => setConfetti((prev) => prev.filter((c) => c.id !== p.id))}
        />
      ))}
      {sparkles.map((s) => (
        <span
          key={`s-${s.id}`}
          className="birthday-sparkle"
          style={{ left: `${s.x}vw`, fontSize: `${s.size}px`, animationDuration: `${s.duration}s` }}
          onAnimationEnd={() => setSparkles((prev) => prev.filter((sp) => sp.id !== s.id))}
        >
          {s.emoji}
        </span>
      ))}
    </div>,
    document.body
  );
}
