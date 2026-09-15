import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import type { Goal } from "@/hooks/use-goals";
import type { DirectoryProfile } from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };

function personCompletion(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

// Both illustrations are 1672x941. Coordinates below are plain
// percent-of-the-original-artwork -- found by scanning each image for
// near-white petal-colored pixel clusters (not eyeballed), then
// hand-checked against a marker overlay so every one of these really sits on
// a flower. Re-sample if either file changes again.

// Dark (night) art: unchanged since the last re-sample. Canvas shows the
// full frame (`background-size: contain`), so these map straight through
// with no transform.
const DARK_BRANCH_POSITIONS: Pos[] = [
  { x: 49.7, y: 26.1 },
  { x: 53.6, y: 28.7 },
  { x: 45.3, y: 29.4 },
  { x: 42.4, y: 34.2 },
  { x: 56.1, y: 34.6 },
  { x: 47.9, y: 38.0 },
  { x: 39.3, y: 40.4 },
  { x: 60.1, y: 42.0 },
  { x: 43.3, y: 43.4 },
  { x: 46.1, y: 45.5 },
  { x: 52.1, y: 45.5 },
  { x: 61.7, y: 48.6 },
  { x: 38.1, y: 48.7 },
  { x: 56.3, y: 48.7 },
  { x: 64.3, y: 54.1 },
  { x: 42.8, y: 54.3 },
  { x: 35.4, y: 55.4 },
  { x: 59.4, y: 57.2 },
  { x: 39.7, y: 59.1 },
  { x: 61.2, y: 62.4 },
  { x: 43.7, y: 65.8 },
  { x: 56.2, y: 65.9 },
];
const DARK_CENTROID = { x: 50, y: 46 };
const DARK_ZOOM = 1;

// Light (day) art: replaced with a pulled-back version that has generous
// sky/ground bleed around a much smaller tree, specifically so its edges
// never have to show -- LIGHT_ZOOM below scales the background past 100%
// (`background-size`) so only the deep interior is ever visible, pushing the
// image's actual boundary safely outside the viewport instead of ending in
// a hard edge. Flower coordinates stay in original-artwork percent; they're
// re-projected onto that zoomed frame in useFlowerSlots below.
const LIGHT_BRANCH_POSITIONS: Pos[] = [
  { x: 49.21, y: 46.97 },
  { x: 46.19, y: 49.87 },
  { x: 51.95, y: 49.89 },
  { x: 43.66, y: 53.25 },
  { x: 54.25, y: 53.54 },
  { x: 48.09, y: 54.89 },
  { x: 52.51, y: 57.14 },
  { x: 41.77, y: 58.20 },
  { x: 56.56, y: 58.27 },
  { x: 45.28, y: 59.21 },
  { x: 50.98, y: 61.37 },
  { x: 53.80, y: 63.39 },
  { x: 58.21, y: 63.53 },
  { x: 44.76, y: 65.51 },
  { x: 39.61, y: 67.32 },
  { x: 55.65, y: 67.76 },
  { x: 42.50, y: 67.84 },
  { x: 56.49, y: 71.03 },
  { x: 44.67, y: 73.36 },
  { x: 53.79, y: 73.40 },
];
const LIGHT_CENTROID = { x: 49, y: 60 };
const LIGHT_ZOOM = 1.15;

const TWO_PI = Math.PI * 2;

type FlowerSlot = Pos & { angle: number };

// Re-projects a raw original-artwork-percent point onto the zoomed
// `background-size` frame: at zoom Z centered, the visible window covers
// original-percent range [marginPct, 100-marginPct] on each axis, where
// marginPct = 50*(1 - 1/Z). Z=1 (dark theme) is a no-op.
function applyZoom(pos: Pos, zoom: number): Pos {
  if (zoom === 1) return pos;
  const marginPct = 50 * (1 - 1 / zoom);
  const span = 100 - 2 * marginPct;
  return {
    x: ((pos.x - marginPct) / span) * 100,
    y: ((pos.y - marginPct) / span) * 100,
  };
}

function buildFlowerSlots(raw: Pos[], centroid: Pos, zoom: number): FlowerSlot[] {
  // Centroid is given in original-artwork percent too, so it needs the same
  // zoom projection as the points before angles are measured against it --
  // otherwise the angle math mixes zoomed and unzoomed coordinate spaces.
  const zoomedCentroid = applyZoom(centroid, zoom);
  return raw
    .map((p) => applyZoom(p, zoom))
    .map((p) => ({ ...p, angle: Math.atan2(p.y - zoomedCentroid.y, p.x - zoomedCentroid.x) }))
    .sort((a, b) => a.angle - b.angle);
}

// Both illustrations are 1672x941 -- same ratio used below regardless of
// theme.
const IMAGE_RATIO = 1672 / 941;

// At lg+ the canvas switches from an aspect-ratio-locked box (grows however
// tall a full-bleed width demands, which is what forced the page to scroll
// on wide/short viewports) to a fixed, viewport-capped height with
// `background-size: cover` -- so it always fits on screen, at the cost of
// cropping whichever axis the real viewport doesn't match the art's own
// ratio on. `cover` only ever crops ONE axis (never distorts), so this
// mirrors applyZoom's margin math but for a single, measured axis instead of
// a fixed author-time zoom constant.
function applyCoverCrop(pos: Pos, containerRatio: number): Pos {
  if (containerRatio >= IMAGE_RATIO) {
    const marginPct = 50 * (1 - IMAGE_RATIO / containerRatio);
    const span = 100 - 2 * marginPct;
    return { x: pos.x, y: ((pos.y - marginPct) / span) * 100 };
  }
  const marginPct = 50 * (1 - containerRatio / IMAGE_RATIO);
  const span = 100 - 2 * marginPct;
  return { x: ((pos.x - marginPct) / span) * 100, y: pos.y };
}

function buildFlowerSlotsCover(raw: Pos[], centroid: Pos, containerRatio: number): FlowerSlot[] {
  const projectedCentroid = applyCoverCrop(centroid, containerRatio);
  return raw
    .map((p) => applyCoverCrop(p, containerRatio))
    .map((p) => ({ ...p, angle: Math.atan2(p.y - projectedCentroid.y, p.x - projectedCentroid.x) }))
    .sort((a, b) => a.angle - b.angle);
}

// Groups people by department (not role) so teammates from the same
// department land on a contiguous slice of the canopy instead of scattered
// randomly -- per "space it out ... separate by department". Each
// department gets a slice of the full loop proportional to its headcount
// (so a handful of people still spread across the *whole* tree instead of
// bunching into the first few flowers), with a small gap between slices.
// Each person's target angle within their slice snaps to whichever
// still-unused real flower is angularly closest, so placement always lands
// on an actual flower rather than a computed point that might miss one.
function computeTreePositions(people: DirectoryProfile[], flowerSlots: FlowerSlot[]): Map<string, Pos> {
  const positions = new Map<string, Pos>();
  const n = people.length;
  if (n === 0) return positions;

  const groups = new Map<string, DirectoryProfile[]>();
  for (const p of people) {
    const key = p.department ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const GAP_FRAC = 0.02;
  const availableFrac = Math.max(0.3, 1 - GAP_FRAC * groups.size);
  const fracPerPerson = availableFrac / n;

  const used = new Set<number>();
  let fracCursor = 0;
  let overflow = 0;

  for (const members of groups.values()) {
    const k = members.length;
    members.forEach((person, j) => {
      const frac = fracCursor + (j + 0.5) * fracPerPerson;
      const targetAngle = -Math.PI + frac * TWO_PI;

      let bestIdx = -1;
      let bestDist = Infinity;
      flowerSlots.forEach((slot, i) => {
        if (used.has(i)) return;
        let d = Math.abs(slot.angle - targetAngle);
        if (d > Math.PI) d = TWO_PI - d;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });

      if (bestIdx === -1) {
        // Every flower is already taken (more people than flowers) -- reuse
        // spots in order, nudged down a little per lap so a repeat doesn't
        // sit exactly on top of the earlier person's flower.
        const idx = overflow % flowerSlots.length;
        const lap = Math.floor(overflow / flowerSlots.length) + 1;
        const slot = flowerSlots[idx];
        positions.set(person.id, { x: slot.x, y: Math.min(97, slot.y + lap * 3) });
        overflow += 1;
      } else {
        used.add(bestIdx);
        const slot = flowerSlots[bestIdx];
        positions.set(person.id, { x: slot.x, y: slot.y });
      }
    });
    fracCursor += k * fracPerPerson + GAP_FRAC;
  }

  return positions;
}

// The flower coordinates are just an anchor point -- the real painted
// flower stays hidden under the avatar (that's the point of using it as a
// "mark point"), not decorated or re-drawn, so the marker is a plain photo
// circle sitting exactly where the flower is.
function TreePersonNode({
  person,
  goals,
  x,
  y,
  selected,
  onClick,
}: {
  person: DirectoryProfile;
  goals: Goal[];
  x: number;
  y: number;
  selected: boolean;
  onClick: () => void;
}) {
  const completion = personCompletion(goals);
  const pillColor = colorForId(person.id);
  const avatarSize = selected ? 52 : 36;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group z-10 hover:z-20"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`@${person.username} -- ${completion}% of goals`}
    >
      <span className="relative shrink-0 rounded-full">
        {selected && (
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full blur-md pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(232,121,249,0.6), transparent 70%)" }}
          />
        )}
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          style={{ width: avatarSize, height: avatarSize }}
          className={cn(
            "relative z-10 border-2 border-white shadow-md group-hover:scale-110 transition-transform",
            selected && "ring-2 ring-fuchsia-400"
          )}
        />
      </span>

      <span className="flex flex-col items-center leading-none">
        <span className="text-[9px] font-bold text-white bg-black/55 backdrop-blur-sm rounded-full px-1.5 py-0.5 whitespace-nowrap max-w-[84px] truncate">
          @{person.username}
        </span>
        <span className={cn("mt-0.5 text-[8px] font-bold text-white rounded-full px-1.5 py-0.5 whitespace-nowrap", pillColor)}>
          {completion}%
        </span>
      </span>
    </button>
  );
}

export function GoalsTreeView({
  people,
  goalsByOwner,
  onSelect,
  selectedId,
  header,
}: {
  people: DirectoryProfile[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (person: DirectoryProfile) => void;
  selectedId: string | null;
  // The page heading/search/toggle row, at lg+ only -- rendered as an
  // overlay INSIDE this same box (see the reference mockups) so it sits
  // directly on the sharp art with no seam, instead of on a separate blurred
  // strip above a distinct canvas. Below lg the page renders its own plain
  // in-flow header instead (not enough room to overlay it legibly on a
  // short, full-bleed-width mobile image) -- this prop is simply not shown
  // there (`hidden lg:block` below).
  header?: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  // Two separate illustrations (a moonlit tree, a sunlit one) rather than
  // trying to fade/tint one image into both themes.
  const bgFile = isLight ? "tree-bg-light.png" : "tree-bg.png";
  // Light art was redrawn pulled further back specifically so LIGHT_ZOOM can
  // scale the background past 100% and hide its real edges (see the
  // LIGHT_BRANCH_POSITIONS comment above) -- dark art is unchanged, so it
  // stays at zoom 1 / `contain` exactly as before.
  const zoom = isLight ? LIGHT_ZOOM : DARK_ZOOM;

  // Below lg the canvas keeps its original aspect-ratio-locked sizing
  // (height follows width, growing however tall a full-bleed image demands
  // -- fine there since the page already scrolls on mobile). At lg+ it
  // switches to a viewport-capped fixed height with `background-size: cover`
  // instead, specifically so the Tree View section fits on screen without
  // forcing a scroll on a section that's meant to read as a static scene.
  // `containerRatio` is the box's REAL measured aspect ratio (unlike the
  // aspect-locked path, it isn't known until layout -- it shifts with every
  // viewport size at lg+), used to project flower coordinates through the
  // matching single-axis crop `background-size: cover` will apply.
  const [isLgUp, setIsLgUp] = useState(false);
  const [containerRatio, setContainerRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isLgUp || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setContainerRatio(width / height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLgUp]);

  const flowerSlots = useMemo(() => {
    const raw = isLight ? LIGHT_BRANCH_POSITIONS : DARK_BRANCH_POSITIONS;
    const centroid = isLight ? LIGHT_CENTROID : DARK_CENTROID;
    if (isLgUp && containerRatio) return buildFlowerSlotsCover(raw, centroid, containerRatio);
    return buildFlowerSlots(raw, centroid, zoom);
  }, [isLight, zoom, isLgUp, containerRatio]);
  const positions = useMemo(() => computeTreePositions(people, flowerSlots), [people, flowerSlots]);

  return (
    // This *is* the environment, not a picture placed in one: no border,
    // shadow, rounded corners, card background, or margin box. Below lg the
    // canvas is locked to the artwork's own 3:2 ratio (via aspect-ratio);
    // at lg+ it's a fixed, viewport-capped height with `cover` instead (see
    // the containerRatio comment above) so the whole Tree View section --
    // heading, search, toggle and all, now that `header` overlays directly
    // on it -- fits on screen without scrolling. Dark theme's `contain`/
    // zoom-1 sizing below lg shows nothing cropped; light theme
    // intentionally zooms past 100% so its wide-bleed art never shows its
    // actual edge -- flower percentages already account for whichever
    // sizing mode is active. No `role="img"` here anymore: once real
    // interactive controls (search, toggle, Add Goals) live inside this box
    // at lg+, that role would tell assistive tech to treat the whole thing
    // as a single opaque image and hide them -- the sr-only span below
    // keeps a description without doing that.
    <div
      ref={containerRef}
      className={cn(
        "relative w-full aspect-[1672/941] lg:aspect-auto lg:h-screen bg-center bg-no-repeat",
        isLight ? "bg-[length:115%_115%] lg:bg-cover" : "bg-contain lg:bg-cover"
      )}
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})` }}
    >
      <span className="sr-only">A glowing illustrated tree, each teammate growing from their own flower</span>

      {header && (
        // `lg:pr-[22rem]` reserves room for the detail panel's ~20rem width
        // plus its own right gap -- without it, the header's centered search
        // bar collides with the panel at the narrow end of the lg range
        // (just above 1024px, before `xl:pr-8` gives the header its normal
        // padding back once there's enough room for both side by side).
        <div className="hidden lg:block absolute inset-x-0 top-0 z-30 p-6 lg:pr-[22rem] xl:p-8 xl:pr-8">{header}</div>
      )}

      {people.map((person) => {
        const pos = positions.get(person.id);
        if (!pos) return null;
        return (
          <TreePersonNode
            key={person.id}
            person={person}
            goals={goalsByOwner.get(person.id) ?? []}
            x={pos.x}
            y={pos.y}
            selected={person.id === selectedId}
            onClick={() => onSelect(person)}
          />
        );
      })}

      {people.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm text-center px-8 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
          No one matches your search.
        </div>
      )}
    </div>
  );
}
