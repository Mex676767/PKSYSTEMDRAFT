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
const TREE_FOCAL_Y = 0;
const TREE_BACKGROUND_POSITION = `center ${TREE_FOCAL_Y * 100}%`;
const TWO_PI = Math.PI * 2;
// How far down from the top every node is pinned on desktop, to clear the
// floating search/header bar. Shared between the render style and the
// collision resolver so they agree on where nodes actually end up.
const HEADER_CLEARANCE_PX = 280;

type FlowerSlot = Pos & { angle: number };

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
  const zoomedCentroid = applyZoom(centroid, zoom, focalY);
  return raw
    .map((p) => applyZoom(p, zoom, focalY))
    .map((p) => ({ ...p, angle: Math.atan2(p.y - zoomedCentroid.y, p.x - zoomedCentroid.x) }))
    .sort((a, b) => a.angle - b.angle);
}

const IMAGE_RATIO = 1884 / 835;

const EXTRA_ZOOM = 1.15;

function coverScale(containerRatio: number): number {
  return Math.max(containerRatio / IMAGE_RATIO, 1) * EXTRA_ZOOM;
}

function coverBackgroundSize(containerRatio: number): string {
  const s = coverScale(containerRatio);
  const sizeXPct = ((IMAGE_RATIO * s) / containerRatio) * 100;
  const sizeYPct = s * 100;
  return `${sizeXPct}% ${sizeYPct}%`;
}

function applyCoverCrop(pos: Pos, containerRatio: number, focalY: number): Pos {
  const s = coverScale(containerRatio);
  const marginPctX = 50 * (1 - containerRatio / (IMAGE_RATIO * s));
  const spanX = 100 - 2 * marginPctX;
  const totalMarginPctY = 100 * (1 - 1 / s);
  const topMarginY = totalMarginPctY * focalY;
  const spanY = 100 - totalMarginPctY;
  return {
    x: ((pos.x - marginPctX) / spanX) * 100,
    y: ((pos.y - topMarginY) / spanY) * 100,
  };
}

function buildFlowerSlotsCover(raw: Pos[], centroid: Pos, containerRatio: number, focalY: number): FlowerSlot[] {
  const projectedCentroid = applyCoverCrop(centroid, containerRatio, focalY);
  return raw
    .map((p) => applyCoverCrop(p, containerRatio, focalY))
    .map((p) => ({ ...p, angle: Math.atan2(p.y - projectedCentroid.y, p.x - projectedCentroid.x) }))
    .sort((a, b) => a.angle - b.angle);
}

// Nudges any nodes that end up closer together than the target gap (in real
// screen pixels) so their avatars and name tags never render on top of each
// other -- the hand-placed canopy slots are spaced out proportionally, but
// that spacing can compress into overlapping pixels on short/narrow
// containers (mobile), once the team outgrows the slot count, or simply when
// the page is zoomed in (the container shrinks in CSS pixels while the
// avatars stay a fixed size).
const MIN_NODE_GAP_PX = 54;
const RELAXATION_PASSES = 20;

function resolveOverlaps(
  positions: Map<string, Pos>,
  width: number,
  height: number,
  minTopPx = 0
): Map<string, Pos> {
  if (!width || !height) return positions;

  const ids = Array.from(positions.keys());
  const n = ids.length;
  if (n <= 1) return positions;

  // If the container can't actually fit everyone at the ideal spacing (a
  // short mobile strip, the whole page zoomed way in, or a lot of vertical
  // room eaten by the header floor below), shrink the target gap to what the
  // AREA THAT'S ACTUALLY USABLE can realistically support, instead of
  // fighting an impossible constraint -- that fight is what let points get
  // clamped straight back on top of each other. Margins are estimated with a
  // fixed constant here since the real margins depend on the gap this derives.
  const marginEstimate = MIN_NODE_GAP_PX / 2;
  const usableWidth = Math.max(1, width - 2 * marginEstimate);
  const usableHeight = Math.max(1, height - Math.max(minTopPx, marginEstimate) - marginEstimate);
  const feasibleGap = Math.sqrt((usableWidth * usableHeight) / n) * 0.82;
  const gap = Math.min(MIN_NODE_GAP_PX, Math.max(16, feasibleGap));
  const marginX = Math.min(width / 2 - 0.5, gap / 2);
  const marginY = Math.min(height / 2 - 0.5, gap / 2);
  // The node's own `top` style separately clamps to at least minTopPx (to
  // clear the header on desktop) -- if we don't honor that same floor here,
  // every node whose y lands above it collapses onto that one line in the
  // browser regardless of how far apart we thought we'd pushed them.
  const topFloor = Math.min(minTopPx, height - marginY);

  const points = ids.map((id) => {
    const p = positions.get(id)!;
    return { x: (p.x / 100) * width, y: (p.y / 100) * height };
  });

  const clamp = (pt: { x: number; y: number }) => {
    pt.x = Math.min(width - marginX, Math.max(marginX, pt.x));
    pt.y = Math.min(height - marginY, Math.max(topFloor, marginY, pt.y));
  };

  // A push straight up/down is useless against the header floor above -- it
  // gets clamped back to the same line every pass, so two nodes that start
  // directly above/below each other (some hand-placed canopy slots share an
  // x) can get stuck permanently coincident. Fall back to a deterministic,
  // guaranteed-mostly-horizontal angle whenever the natural push would be
  // near-vertical (magnitude capped well under 90 degrees so it can never
  // trip this same guard again).
  const pushApart = (i: number, j: number, dx: number, dy: number, dist: number) => {
    let angle = dist === 0 ? NaN : Math.atan2(dy, dx);
    if (Number.isNaN(angle) || Math.abs(Math.cos(angle)) < 0.35) {
      const dir = (i + j) % 2 === 0 ? 1 : -1;
      const wobble = ((i * 5 + j * 11) % 7) / 7;
      angle = dir * (0.15 + wobble * 0.7);
    }
    const push = (gap - dist) / 2;
    return { ux: Math.cos(angle) * push, uy: Math.sin(angle) * push };
  };

  for (let pass = 0; pass < RELAXATION_PASSES; pass++) {
    let movedAny = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist >= gap) continue;
        movedAny = true;
        const { ux, uy } = pushApart(i, j, dx, dy, dist);
        points[i].x -= ux;
        points[i].y -= uy;
        points[j].x += ux;
        points[j].y += uy;
      }
    }
    // Keep every point inside the container after EVERY pass, not just once
    // at the end -- clamping only at the end is what let crowded points get
    // pushed miles outside the box and then slammed back onto the same edge.
    points.forEach(clamp);
    if (!movedAny) break;
  }

  // Anyone still sitting on the header floor after relaxation is fundamentally
  // a 1D layout problem, not a 2D one -- when a large share of the canopy
  // slots land above that line, they're all fighting over the same row and
  // pairwise relaxation alone doesn't reliably converge to clean, even
  // spacing in a fixed number of passes. Lay that row out explicitly instead.
  const floorSet = new Set<number>();
  if (topFloor > marginY) {
    const onFloor = points
      .map((pt, i) => ({ pt, i }))
      .filter(({ pt }) => pt.y <= topFloor + 0.5)
      .sort((a, b) => a.pt.x - b.pt.x);
    if (onFloor.length > 1) {
      const rowGap = Math.min(gap, (width - 2 * marginX) / (onFloor.length - 1));
      const totalSpan = (onFloor.length - 1) * rowGap;
      const avgX = onFloor.reduce((sum, o) => sum + o.pt.x, 0) / onFloor.length;
      const startX = Math.max(marginX, Math.min(width - marginX - totalSpan, avgX - totalSpan / 2));
      onFloor.forEach(({ pt, i }, idx) => {
        pt.x = startX + idx * rowGap;
        pt.y = topFloor;
        floorSet.add(i);
      });
    }
  }

  // The floor row is now a fixed, evenly-spaced anchor -- but any point that
  // landed just *below* it (close enough in x/y to still collide, without
  // having been floor-clamped itself) was never checked against it. Run a
  // few more passes so those stragglers get pushed clear too, without
  // disturbing the floor row's now-correct spacing.
  for (let pass = 0; pass < 8; pass++) {
    let movedAny = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (floorSet.has(i) && floorSet.has(j)) continue;
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist >= gap) continue;
        movedAny = true;
        const { ux, uy } = pushApart(i, j, dx, dy, dist);
        if (!floorSet.has(i)) {
          points[i].x -= ux;
          points[i].y -= uy;
        }
        if (!floorSet.has(j)) {
          points[j].x += ux;
          points[j].y += uy;
        }
      }
    }
    points.forEach((pt, i) => {
      if (!floorSet.has(i)) clamp(pt);
    });
    if (!movedAny) break;
  }

  const result = new Map<string, Pos>();
  ids.forEach((id, i) => {
    result.set(id, {
      x: (points[i].x / width) * 100,
      y: (points[i].y / height) * 100,
    });
  });
  return result;
}

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

function TreePersonNode(
  {
    person,
    goals,
    x,
    y,
    minTopPx,
    selected,
    onClick,
  }: {
    person: DirectoryProfile;
    goals: Goal[];
    x: number;
    y: number;
    minTopPx?: number
    selected: boolean;
    onClick: () => void;
  }
) {
  const completion = personCompletion(goals);
  const pillColor = colorForId(person.id);
  const avatarSize = selected ? 52 : 36;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group z-10 hover:z-20"
      style={{ left: `${x}%`, top: minTopPx ? `max(${y}%, ${minTopPx}px)` : `${y}%` }}
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
  header?: React.ReactNode
}) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const bgFile = isLight ? "tree-bg-light.png" : "tree-bg.png";

  const [isLgUp, setIsLgUp] = useState(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Tracked on every breakpoint (not just lg+) so the overlap-resolution pass
  // below always has the real on-screen container size to work in pixels.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerRatio = containerSize ? containerSize.width / containerSize.height : null;

  const flowerSlots = useMemo(() => {
    if (isLgUp && containerRatio) return buildFlowerSlotsCover(CANOPY_SLOTS, CANOPY_CENTROID, containerRatio, TREE_FOCAL_Y);
    return buildFlowerSlots(CANOPY_SLOTS, CANOPY_CENTROID, TREE_ZOOM, TREE_FOCAL_Y);
  }, [isLgUp, containerRatio]);
  const positions = useMemo(() => {
    const raw = computeTreePositions(people, flowerSlots);
    if (!containerSize) return raw;
    return resolveOverlaps(raw, containerSize.width, containerSize.height, isLgUp ? HEADER_CLEARANCE_PX : 0);
  }, [people, flowerSlots, containerSize, isLgUp]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[1884/835] lg:aspect-auto lg:h-screen bg-[length:108%_108%] lg:bg-cover bg-no-repeat"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
        backgroundPosition: TREE_BACKGROUND_POSITION,
        ...(isLgUp && containerRatio ? { backgroundSize: coverBackgroundSize(containerRatio) } : {}),
      }}
    >
      <span className="sr-only">A glowing illustrated tree, each teammate growing somewhere in its canopy</span>

      {header && (
        <div
          aria-hidden
          className="hidden lg:block absolute inset-0 bg-cover bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
            backgroundPosition: TREE_BACKGROUND_POSITION,
            ...(containerRatio ? { backgroundSize: coverBackgroundSize(containerRatio) } : {}),
            filter: "blur(60px)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
            maskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
          }}
        />
      )}

      {header && (
        <div
          className="hidden lg:block absolute inset-x-0 top-0 z-30 pt-20 px-6 pb-6 lg:pr-[22rem] xl:pt-24 xl:px-8 xl:pb-8 xl:pr-8 pointer-events-none [&_input]:pointer-events-auto [&_button]:pointer-events-auto"
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
            minTopPx={isLgUp ? HEADER_CLEARANCE_PX : undefined}
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
