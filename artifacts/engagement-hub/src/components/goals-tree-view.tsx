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

// The two tree illustrations are landscape (1536x1024). These are the
// actual white-flower centers on that canopy -- found by scanning the image
// for near-white petal-colored pixel clusters (not just eyeballed), then
// hand-checked against a marker overlay so every one of these really sits on
// a flower. Canopy-only (the couple of flowers down in the grass are
// excluded). Percentages are relative to the ORIGINAL 1536x1024 artwork;
// useCoverMapping below re-projects them onto whatever crop is actually
// visible once the background renders with `background-size: cover`.
// Re-sample if the art ever changes.
const IMAGE_W = 1536;
const IMAGE_H = 1024;
const BRANCH_POSITIONS: Pos[] = [
  { x: 54.3, y: 22.4 },
  { x: 42.7, y: 24.0 },
  { x: 38.0, y: 28.8 },
  { x: 59.9, y: 28.9 },
  { x: 57.8, y: 33.4 },
  { x: 46.5, y: 34.2 },
  { x: 34.7, y: 37.1 },
  { x: 64.7, y: 39.0 },
  { x: 39.4, y: 40.3 },
  { x: 43.9, y: 43.0 },
  { x: 53.0, y: 43.7 },
  { x: 58.2, y: 48.1 },
  { x: 68.6, y: 48.4 },
  { x: 32.2, y: 49.0 },
  { x: 71.8, y: 53.8 },
  { x: 39.0, y: 54.2 },
  { x: 28.5, y: 56.4 },
  { x: 63.6, y: 57.4 },
  { x: 35.0, y: 61.6 },
  { x: 66.7, y: 63.4 },
  { x: 58.1, y: 67.2 },
  { x: 39.9, y: 67.6 },
];

// Canopy centroid the flower angles below are measured from (roughly the
// middle of the BRANCH_POSITIONS above).
const CANOPY_CX = 50;
const CANOPY_CY = 45;
const TWO_PI = Math.PI * 2;

type FlowerSlot = Pos & { angle: number };

const FLOWER_SLOTS: FlowerSlot[] = BRANCH_POSITIONS.map((p) => ({
  ...p,
  angle: Math.atan2(p.y - CANOPY_CY, p.x - CANOPY_CX),
})).sort((a, b) => a.angle - b.angle);

// Groups people by department (not role) so teammates from the same
// department land on a contiguous slice of the canopy instead of scattered
// randomly -- per "space it out ... separate by department". Each
// department gets a slice of the full loop proportional to its headcount
// (so a handful of people still spread across the *whole* tree instead of
// bunching into the first few flowers), with a small gap between slices.
// Each person's target angle within their slice snaps to whichever
// still-unused real flower is angularly closest, so placement always lands
// on an actual flower rather than a computed point that might miss one.
function computeTreePositions(people: DirectoryProfile[]): Map<string, Pos> {
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
      FLOWER_SLOTS.forEach((slot, i) => {
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
        const idx = overflow % FLOWER_SLOTS.length;
        const lap = Math.floor(overflow / FLOWER_SLOTS.length) + 1;
        const slot = FLOWER_SLOTS[idx];
        positions.set(person.id, { x: slot.x, y: Math.min(97, slot.y + lap * 3) });
        overflow += 1;
      } else {
        used.add(bestIdx);
        const slot = FLOWER_SLOTS[bestIdx];
        positions.set(person.id, { x: slot.x, y: slot.y });
      }
    });
    fracCursor += k * fracPerPerson + GAP_FRAC;
  }

  return positions;
}

// Tracks an element's own rendered box size so we can re-project the
// artwork's flower coordinates onto whatever `background-size: cover`
// actually shows (see useCoverMapping) -- keeps markers glued to their
// flower through any resize instead of drifting once the crop changes.
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

// `background-size: cover` scales the 1536x1024 artwork up until it fills
// the box, then crops whichever axis overflows, centered. A flower's
// percentage position on the *original* artwork therefore doesn't land at
// the same percentage inside the box once cropping kicks in -- this maps
// original-image percent -> percent-within-the-visible-crop, so markers
// stay glued to their flower at any container size instead of drifting.
function useCoverMapping(containerW: number, containerH: number) {
  return useMemo(() => {
    const imageAspect = IMAGE_W / IMAGE_H;
    const containerAspect = containerW && containerH ? containerW / containerH : imageAspect;

    let visibleWFrac = 1;
    let visibleHFrac = 1;
    if (containerAspect > imageAspect) {
      visibleHFrac = imageAspect / containerAspect;
    } else {
      visibleWFrac = containerAspect / imageAspect;
    }
    const leftCrop = (1 - visibleWFrac) / 2;
    const topCrop = (1 - visibleHFrac) / 2;

    return (pos: Pos): Pos => {
      const xFrac = (pos.x / 100 - leftCrop) / visibleWFrac;
      const yFrac = (pos.y / 100 - topCrop) / visibleHFrac;
      return {
        x: Math.min(99, Math.max(1, xFrac * 100)),
        y: Math.min(99, Math.max(1, yFrac * 100)),
      };
    };
  }, [containerW, containerH]);
}

// A small avatar centered right on the flower (the flower's petals still
// show around/behind it, per "growing from the flower" rather than
// covering it), with the name and progress stacked underneath -- flower,
// then avatar, then name, then %, top to bottom.
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
  const size = selected ? "w-8 h-8" : "w-6 h-6";

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
            style={{ background: "radial-gradient(circle, rgba(232,121,249,0.65), transparent 70%)" }}
          />
        )}
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className={cn(
            "relative z-10 border-2 border-white shadow-md group-hover:scale-110 transition-transform",
            size,
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
}: {
  people: DirectoryProfile[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (person: DirectoryProfile) => void;
  selectedId: string | null;
}) {
  const positions = useMemo(() => computeTreePositions(people), [people]);
  const { resolvedTheme } = useTheme();
  // Two separate illustrations (a moonlit tree, a sunlit one) rather than
  // trying to fade/tint one image into both themes.
  const bgFile = resolvedTheme === "light" ? "tree-bg-light.png" : "tree-bg.png";

  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const mapToVisible = useCoverMapping(width, height);

  return (
    // This *is* the environment, not a picture placed in one: no border,
    // shadow, rounded corners, card background, or margin box -- the
    // artwork is a `background-size: cover` layer that fills this section
    // edge to edge, so there's no rectangle for the eye to read as "an
    // image". useCoverMapping keeps every flower marker glued to its actual
    // flower regardless of how much of the artwork `cover` crops at the
    // current width/height.
    <div
      ref={containerRef}
      // Below `sm`, keep the section at the artwork's own 3:2 ratio (no
      // crop at all) instead of the viewport-height treatment -- forcing a
      // tall, narrow box on a phone screen made `cover` zoom in hard enough
      // to crop flowers (and their name labels) right off the edges.
      className="relative w-full aspect-[3/2] sm:aspect-auto sm:h-[62vh] sm:min-h-[420px] sm:max-h-[720px]"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      role="img"
      aria-label="A glowing illustrated tree, each teammate growing from their own flower"
    >
      {people.map((person) => {
        const pos = positions.get(person.id);
        if (!pos) return null;
        const mapped = mapToVisible(pos);
        return (
          <TreePersonNode
            key={person.id}
            person={person}
            goals={goalsByOwner.get(person.id) ?? []}
            x={mapped.x}
            y={mapped.y}
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
