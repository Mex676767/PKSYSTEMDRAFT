import { useMemo } from "react";
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

// The two tree illustrations are landscape (1536x1024, a 3:2 ratio). These
// are the actual white-flower centers on that canopy -- found by scanning
// the image for near-white petal-colored pixel clusters (not just
// eyeballed), then hand-checked against a marker overlay so every one of
// these really sits on a flower. Canopy-only (the couple of flowers down in
// the grass are excluded). Percentages are plain percent-of-the-artwork: the
// canvas below is locked to the artwork's own 3:2 aspect ratio (never
// cropped), so these never need remapping regardless of viewport size.
// Re-sample if the art ever changes.
const IMAGE_ASPECT = "3 / 2";
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

  return (
    // This *is* the environment, not a picture placed in one: no border,
    // shadow, rounded corners, card background, or margin box. The canvas
    // is locked to the artwork's own 3:2 ratio (via aspect-ratio, not a
    // viewport-height guess), so `background-size: contain` never has to
    // crop anything -- full sky, moon, roots and grass all stay visible no
    // matter how wide or narrow the available width is. Because the canvas
    // and the artwork always share the same aspect ratio, the flower
    // percentages below map straight through with no crop-remapping needed.
    <div
      className="relative w-full"
      style={{
        aspectRatio: IMAGE_ASPECT,
        backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      role="img"
      aria-label="A glowing illustrated tree, each teammate growing from their own flower"
    >
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
