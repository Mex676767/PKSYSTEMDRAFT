import { useEffect } from "react";

const SPARKLE_GLYPHS = ["✦", "✧", "⋆", "•"];
const SPARKLE_COLORS = ["#ec4899", "#fb923c", "#a855f7", "#22d3ee", "#facc15"];

export function CursorSparkleTrail() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastTime = 0;
    const handler = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastTime < 60) return;
      lastTime = now;

      const sparkle = document.createElement("div");
      sparkle.textContent = SPARKLE_GLYPHS[Math.floor(Math.random() * SPARKLE_GLYPHS.length)];
      sparkle.style.position = "fixed";
      sparkle.style.top = "0";
      sparkle.style.left = "0";
      sparkle.style.pointerEvents = "none";
      sparkle.style.zIndex = "9998";
      sparkle.style.fontSize = "12px";
      sparkle.style.color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
      sparkle.style.left = `${e.clientX}px`;
      sparkle.style.top = `${e.clientY}px`;
      document.body.appendChild(sparkle);

      const animation = sparkle.animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          { transform: "translate(-50%, -150%) scale(0.3)", opacity: 0 },
        ],
        { duration: 600, easing: "ease-out" }
      );
      animation.onfinish = () => sparkle.remove();
    };

    document.addEventListener("mousemove", handler);
    return () => document.removeEventListener("mousemove", handler);
  }, []);

  return null;
}
