// A scalloped/spiky frame that sits behind the avatar and peeks out around
// its edges -- like Discord's avatar decorations, not just a flat colored
// ring. One shared path generator, themed per border key via gradient
// colors and spike count so each catalog entry doesn't need hand-drawn art.

type BorderTheme = { colors: string[]; spikes: number; outerR: number; innerR: number };

const BORDER_THEMES: Record<string, BorderTheme> = {
  bronze: { colors: ["#c88a4e", "#8a5a2b", "#5c3a1a"], spikes: 9, outerR: 50, innerR: 38 },
  silver: { colors: ["#f1f5f9", "#cbd5e1", "#8a97a6"], spikes: 10, outerR: 49, innerR: 39 },
  gold: { colors: ["#fff2b0", "#ffd75e", "#c9891a"], spikes: 11, outerR: 51, innerR: 37 },
  neon: { colors: ["#ff8ae2", "#ff5fd1", "#7c3aed"], spikes: 13, outerR: 51, innerR: 38 },
  rainbow: { colors: ["#ff5757", "#ffd15c", "#4ade80", "#38bdf8", "#a78bfa", "#ff5757"], spikes: 15, outerR: 51, innerR: 38 },
};

function scallopedRingPath(spikes: number, outerR: number, innerR: number, cx = 50, cy = 50) {
  const pts: [number, number][] = [];
  const n = spikes * 2;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  let d = `M ${pts[0][0]} ${pts[0][1]} `;
  for (let i = 1; i <= n; i++) {
    const [x1, y1] = pts[i % n];
    const [px, py] = pts[i - 1];
    const mx = (px + x1) / 2;
    const my = (py + y1) / 2;
    d += `Q ${px} ${py} ${mx} ${my} `;
  }
  return d + "Z";
}

export function BorderDecoration({ border }: { border: string | null | undefined }) {
  const theme = border ? BORDER_THEMES[border] : undefined;
  if (!theme) return null;

  const gradId = `border-grad-${border}`;
  const path = scallopedRingPath(theme.spikes, theme.outerR, theme.innerR);

  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: "scale(1.4)" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {theme.colors.map((c, i) => (
            <stop key={i} offset={`${(i / (theme.colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gradId})`} stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} />
    </svg>
  );
}

export const BORDER_KEYS = Object.keys(BORDER_THEMES);
