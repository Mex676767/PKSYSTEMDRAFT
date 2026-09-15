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

// Both illustrations are 1884x835 -- a "bigger tree" re-draw (day/night
// pair, same composition/tree position/scale in both) that replaced the
// original 1672x941 pair. Coordinates below are plain
// percent-of-the-original-artwork -- found by scanning each image for
// near-white petal-colored pixel clusters (not eyeballed), merging the
// handful of raw clusters each flower's 5 separate petals produced back
// into one point per flower, then hand-checked against a marker overlay so
// every one of these really sits on a flower (and a few that landed on
// sky/water/town instead were dropped). Re-sample if either file changes
// again. Both now get the same gentle overzoom (TREE_ZOOM) since both share
// the same generous sky/ground bleed and corner leaf sprigs around the tree
// -- previously dark used zoom 1 ("contain", no crop) and light used 1.15,
// back when the two arts had different compositions.
const DARK_BRANCH_POSITIONS: Pos[] = [
  { x: 51.11, y: 9.55 },
  { x: 44.76, y: 15.97 },
  { x: 56.35, y: 16.76 },
  { x: 40.07, y: 25.11 },
  { x: 60.20, y: 25.61 },
  { x: 48.02, y: 25.81 },
  { x: 56.57, y: 34.25 },
  { x: 43.16, y: 34.56 },
  { x: 64.05, y: 35.24 },
  { x: 37.20, y: 35.41 },
  { x: 46.92, y: 38.84 },
  { x: 53.97, y: 41.70 },
  { x: 59.40, y: 45.60 },
  { x: 33.90, y: 46.01 },
  { x: 66.92, y: 46.29 },
  { x: 41.93, y: 48.19 },
  { x: 32.67, y: 52.81 },
  { x: 38.18, y: 54.67 },
  { x: 61.69, y: 54.87 },
  { x: 63.31, y: 63.33 },
  { x: 38.83, y: 65.71 },
  { x: 58.74, y: 66.23 },
  { x: 42.17, y: 66.60 },
  { x: 46.43, y: 66.79 },
];

const LIGHT_BRANCH_POSITIONS: Pos[] = [
  { x: 51.07, y: 11.74 },
  { x: 56.47, y: 18.11 },
  { x: 44.05, y: 19.33 },
  { x: 51.78, y: 22.68 },
  { x: 39.94, y: 26.08 },
  { x: 59.35, y: 26.94 },
  { x: 47.97, y: 27.08 },
  { x: 62.85, y: 28.06 },
  { x: 55.93, y: 35.50 },
  { x: 64.30, y: 36.15 },
  { x: 37.52, y: 36.62 },
  { x: 42.99, y: 37.04 },
  { x: 47.09, y: 40.07 },
  { x: 53.99, y: 42.86 },
  { x: 59.40, y: 46.94 },
  { x: 67.32, y: 47.12 },
  { x: 33.56, y: 47.16 },
  { x: 29.39, y: 48.46 },
  { x: 42.02, y: 50.14 },
  { x: 32.65, y: 53.73 },
  { x: 38.20, y: 55.34 },
  { x: 61.75, y: 55.60 },
  { x: 70.11, y: 62.50 },
  { x: 63.57, y: 63.36 },
  { x: 58.94, y: 66.63 },
  { x: 41.39, y: 66.65 },
  { x: 69.59, y: 67.37 },
  { x: 46.59, y: 67.43 },
  { x: 33.78, y: 67.49 },
];

const TREE_CENTROID = { x: 50, y: 43 };
const TREE_ZOOM = 1.08;

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

// Both illustrations are 1884x835 -- same ratio used below regardless of
// theme.
const IMAGE_RATIO = 1884 / 835;

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
    if (isLgUp && containerRatio) return buildFlowerSlotsCover(raw, TREE_CENTROID, containerRatio);
    return buildFlowerSlots(raw, TREE_CENTROID, TREE_ZOOM);
  }, [isLight, isLgUp, containerRatio]);
  const positions = useMemo(() => computeTreePositions(people, flowerSlots), [people, flowerSlots]);

  return (
    // This *is* the environment, not a picture placed in one: no border,
    // shadow, rounded corners, card background, or margin box. Below lg the
    // canvas is locked to the artwork's own ratio (via aspect-ratio); at
    // lg+ it's a fixed, viewport-capped height with `cover` instead (see
    // the containerRatio comment above) so the whole Tree View section --
    // heading, search, toggle and all, now that `header` overlays directly
    // on it -- fits on screen without scrolling. Below lg, both themes zoom
    // in slightly past 100% (TREE_ZOOM) so the art's own edges and corner
    // leaf sprigs never show -- flower percentages already account for it.
    // No `role="img"` here anymore: once real interactive controls (search,
    // toggle, Add Goals) live inside this box at lg+, that role would tell
    // assistive tech to treat the whole thing as a single opaque image and
    // hide them -- the sr-only span below keeps a description without doing
    // that.
    <div
      ref={containerRef}
      className="relative w-full aspect-[1884/835] lg:aspect-auto lg:h-screen bg-[length:108%_108%] lg:bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})` }}
    >
      <span className="sr-only">A glowing illustrated tree, each teammate growing from their own flower</span>

      {header && (
        // A blurred duplicate of the SAME crop the sharp layer above shows
        // (same background-size/position, sized to the identical box via
        // `inset-0`), faded out after its top ~30% by the mask -- softens
        // whatever's directly behind the heading/search/toggle text (busy
        // leaves, bright clouds) into a smoother, lower-contrast wash so the
        // text stays readable, without covering it with a flat tint (tried
        // first, looked like a pasted-on box) or relying on a text-shadow
        // glow alone (failed against the art's own bright white clouds,
        // where a white glow is no contrast at all). Reusing the sharp
        // layer's exact sizing matters: an earlier version gave this its
        // own fixed height, which sampled a DIFFERENT (much more
        // aggressively cropped) slice of the art than what the sharp layer
        // shows there, so the blur showed unrelated content (the tree's own
        // canopy smeared into a green blob) instead of a softened version of
        // the same sky it's meant to sit in front of. No z-index needed --
        // it has none, so it stacks below the header (z-30) and avatars
        // (z-10+) regardless of DOM order, and above nothing except this
        // same element's own sharp background-image sibling.
        <div
          aria-hidden
          className="hidden lg:block absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
            filter: "blur(60px)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
            maskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
          }}
        />
      )}

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
