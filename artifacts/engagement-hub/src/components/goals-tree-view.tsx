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

// Both illustrations are 1884x835 (day/night pair, same composition/tree
// position/scale in both). Real leaf-canopy positions -- NOT an ellipse
// approximation, NOT individual flowers -- found by flood-filling the
// canopy's actual green-pixel silhouette from a seed point in its center
// (so it traces the real, slightly asymmetric leaf shape and stays
// connected across the gap where trunk/sky show through, while excluding
// disconnected background greenery like the far-off pine trees), then
// picking ~30 points spread evenly through that mask (greedy farthest-point
// sampling) and hand-checked against a marker overlay. Re-run the flood-fill
// if the art changes again -- an ellipse is a poor fit for this canopy's
// actual outline.
const CANOPY_SLOTS: Pos[] = [
  { x: 52.07, y: 3.95 },
  { x: 47.51, y: 8.86 },
  { x: 54.78, y: 12.57 },
  { x: 43.21, y: 14.37 },
  { x: 60.56, y: 16.17 },
  { x: 47.51, y: 19.40 },
  { x: 58.07, y: 23.11 },
  { x: 42.09, y: 23.71 },
  { x: 48.94, y: 26.59 },
  { x: 65.39, y: 27.90 },
  { x: 35.83, y: 30.90 },
  { x: 53.40, y: 31.74 },
  { x: 60.19, y: 31.86 },
  { x: 46.34, y: 32.69 },
  { x: 40.76, y: 36.29 },
  { x: 67.25, y: 37.96 },
  { x: 48.35, y: 41.80 },
  { x: 32.22, y: 43.11 },
  { x: 64.38, y: 44.19 },
  { x: 42.30, y: 46.71 },
  { x: 33.97, y: 51.50 },
  { x: 70.33, y: 53.89 },
  { x: 47.40, y: 54.61 },
  { x: 63.75, y: 55.93 },
  { x: 40.92, y: 57.60 },
  { x: 55.47, y: 61.44 },
  { x: 34.87, y: 62.04 },
  { x: 65.55, y: 63.11 },
  { x: 43.15, y: 64.07 },
  { x: 60.14, y: 66.83 },
  { x: 53.98, y: 69.58 },
  { x: 42.30, y: 70.90 },
];
const CANOPY_CENTROID = { x: 51, y: 40 };
const TREE_ZOOM = 1.08;
// Shifts the visible crop window up within the source image (revealing more
// sky) so the canopy sits lower in the container instead of its topmost
// leaves landing right under the header controls. 0.5 = centered (the old
// behavior); smaller = more sky revealed at the top, tree pushed down. The
// header's own blurred backdrop (elsewhere in this file) already covers
// whatever's newly visible up there -- it reads the same shifted position,
// see its `backgroundPosition` below.
const TREE_FOCAL_Y = 0.25;
const TREE_BACKGROUND_POSITION = `center ${TREE_FOCAL_Y * 100}%`;
const TWO_PI = Math.PI * 2;

type FlowerSlot = Pos & { angle: number };

// Re-projects a raw original-artwork-percent point onto the zoomed
// `background-size` frame: at zoom Z, the visible window covers
// original-percent range [topMargin, 100-bottomMargin] on the Y axis, where
// topMargin/bottomMargin split the total crop (100*(1-1/Z)) according to
// `focalY` (0.5 = centered, matching background-position's own Y percent
// semantics) -- X always stays centered, only Y is ever shifted here.
function applyZoom(pos: Pos, zoom: number, focalY: number): Pos {
  if (zoom === 1 && focalY === 0.5) return pos;
  const totalMarginPct = 100 * (1 - 1 / zoom);
  const marginPctX = totalMarginPct / 2;
  const topMargin = totalMarginPct * focalY;
  const span = 100 - totalMarginPct;
  return {
    x: ((pos.x - marginPctX) / span) * 100,
    y: ((pos.y - topMargin) / span) * 100,
  };
}

function buildFlowerSlots(raw: Pos[], centroid: Pos, zoom: number, focalY: number): FlowerSlot[] {
  // Centroid is given in original-artwork percent too, so it needs the same
  // zoom projection as the points before angles are measured against it --
  // otherwise the angle math mixes zoomed and unzoomed coordinate spaces.
  const zoomedCentroid = applyZoom(centroid, zoom, focalY);
  return raw
    .map((p) => applyZoom(p, zoom, focalY))
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
// a fixed author-time zoom constant. `focalY` only matters when the crop is
// vertical (containerRatio >= IMAGE_RATIO) -- when it's horizontal instead,
// the Y axis isn't cropped at all, so there's nothing to shift.
function applyCoverCrop(pos: Pos, containerRatio: number, focalY: number): Pos {
  if (containerRatio >= IMAGE_RATIO) {
    const totalMarginPct = 100 * (1 - IMAGE_RATIO / containerRatio);
    const topMargin = totalMarginPct * focalY;
    const span = 100 - totalMarginPct;
    return { x: pos.x, y: ((pos.y - topMargin) / span) * 100 };
  }
  const marginPct = 50 * (1 - containerRatio / IMAGE_RATIO);
  const span = 100 - 2 * marginPct;
  return { x: ((pos.x - marginPct) / span) * 100, y: pos.y };
}

function buildFlowerSlotsCover(raw: Pos[], centroid: Pos, containerRatio: number, focalY: number): FlowerSlot[] {
  const projectedCentroid = applyCoverCrop(centroid, containerRatio, focalY);
  return raw
    .map((p) => applyCoverCrop(p, containerRatio, focalY))
    .map((p) => ({ ...p, angle: Math.atan2(p.y - projectedCentroid.y, p.x - projectedCentroid.x) }))
    .sort((a, b) => a.angle - b.angle);
}

// Groups people by department (not role) so teammates from the same
// department land on a contiguous slice of the canopy instead of scattered
// randomly -- per "space it out ... separate by department". Each
// department gets a slice of the full loop proportional to its headcount
// (so a handful of people still spread across the *whole* tree instead of
// bunching into the first few slots), with a small gap between slices.
// Each person's target angle within their slice snaps to whichever
// still-unused canopy slot is angularly closest.
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
        // Every slot is already taken (more people than slots) -- reuse
        // spots in order, nudged down a little per lap so a repeat doesn't
        // sit exactly on top of the earlier person's spot.
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

// A plain photo circle in the canopy -- no decorative frame, nothing
// drawn on top of the art itself.
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
    if (isLgUp && containerRatio) return buildFlowerSlotsCover(CANOPY_SLOTS, CANOPY_CENTROID, containerRatio, TREE_FOCAL_Y);
    return buildFlowerSlots(CANOPY_SLOTS, CANOPY_CENTROID, TREE_ZOOM, TREE_FOCAL_Y);
  }, [isLgUp, containerRatio]);
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
    // leaf sprigs never show -- canopy slot percentages already account for it.
    // No `role="img"` here anymore: once real interactive controls (search,
    // toggle, Add Goals) live inside this box at lg+, that role would tell
    // assistive tech to treat the whole thing as a single opaque image and
    // hide them -- the sr-only span below keeps a description without doing
    // that.
    <div
      ref={containerRef}
      className="relative w-full aspect-[1884/835] lg:aspect-auto lg:h-screen bg-[length:108%_108%] lg:bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`, backgroundPosition: TREE_BACKGROUND_POSITION }}
    >
      <span className="sr-only">A glowing illustrated tree, each teammate growing somewhere in its canopy</span>

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
          className="hidden lg:block absolute inset-0 bg-cover bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
            backgroundPosition: TREE_BACKGROUND_POSITION,
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
        // `pointer-events-none` on the wrapper + `pointer-events-auto` back
        // on just the actual controls: without this, the header's own
        // padding/whitespace (there's a lot of it, since the row spans the
        // full width to keep the search bar centered) sat on top of and
        // blocked clicks on any canopy slot underneath it -- including the
        // topmost one, which made that person's avatar completely
        // unclickable even though it was clearly visible.
        <div
          className="hidden lg:block absolute inset-x-0 top-0 z-30 p-6 lg:pr-[22rem] xl:p-8 xl:pr-8 pointer-events-none [&_input]:pointer-events-auto [&_button]:pointer-events-auto"
        >
          {header}
        </div>
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
