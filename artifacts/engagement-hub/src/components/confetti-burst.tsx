import { useEffect } from "react";

const CONFETTI_COLORS = ["#ec4899", "#fb923c", "#a855f7", "#22d3ee", "#facc15"];

function burst(x: number, y: number) {
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement("div");
    piece.style.position = "fixed";
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.width = "7px";
    piece.style.height = "7px";
    piece.style.borderRadius = "2px";
    piece.style.pointerEvents = "none";
    piece.style.zIndex = "9999";
    piece.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 100;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    const rot = Math.random() * 360;

    const animation = piece.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${dx * 1.2}px, ${dy + 120}px) rotate(${rot * 1.4}deg)`, opacity: 0 },
      ],
      { duration: 800 + Math.random() * 400, easing: "cubic-bezier(.25,.8,.4,1)" }
    );
    animation.onfinish = () => piece.remove();
  }
}

export function ConfettiBurstOnClick() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest("button");
      if (!btn || !btn.classList.contains("bg-gradient-flame")) return;
      burst(e.clientX, e.clientY);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null;
}
