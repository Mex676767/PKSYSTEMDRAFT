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

// The two tree illustrations are landscape (1536x1024, 3:2) with the tree
// pulled back to roughly the center 55-60% of the frame. These are the
// actual white-flower centers on that canopy (found by color-sampling the
// image for their yellow centers, then hand-filtered for spacing) -- sorted
// clockwise around the canopy so contiguous runs read as one arc. Needs
// re-sampling if the art changes again.
const IMAGE_ASPECT = "1536 / 1024";
const BRANCH_POSITIONS: Pos[] = [
  { x: 34.7, y: 37.4 },
  { x: 38.1, y: 28.8 },
  { x: 46.5, y: 34.3 },
  { x: 42.7, y: 24.2 },
  { x: 54.4, y: 22.7 },
  { x: 59.9, y: 29.2 },
  { x: 64.7, y: 39.1 },
  { x: 68.6, y: 48.7 },
  { x: 58.2, y: 48.1 },
  { x: 53.0, y: 43.8 },
  { x: 63.6, y: 57.7 },
  { x: 66.6, y: 63.5 },
  { x: 58.4, y: 67.3 },
  { x: 54.7, y: 58.9 },
  { x: 46.8, y: 53.9 },
  { x: 44.3, y: 60.5 },
  { x: 39.9, y: 67.9 },
  { x: 34.9, y: 61.9 },
  { x: 39.0, y: 54.4 },
  { x: 28.6, y: 56.5 },
  { x: 44.0, y: 43.2 },
  { x: 32.2, y: 49.2 },
];

// Canopy center the flower angles below are measured from (not the image
// center -- the canopy sits a bit left-of-center, higher up).
const CANOPY_CX = 50;
const CANOPY_CY = 40;
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 group"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`@${person.username} -- ${completion}% of goals`}
    >
      <span
        className={cn(
          "relative shrink-0 rounded-full transition-shadow",
          selected && "ring-4 ring-fuchsia-400/80 ring-offset-2 ring-offset-transparent shadow-[0_0_20px_rgba(217,70,239,0.65)]"
        )}
      >
        {/* Soft warm glow, echoing the fireflies already glowing in the
            illustration, so each avatar reads as part of the tree's own
            lighting rather than a flat sticker laid on top. */}
        <span
          aria-hidden
          className="absolute -inset-2 rounded-full blur-md opacity-70 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(253,224,71,0.5), transparent 70%)" }}
        />
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className="relative z-10 w-16 h-16 border-[3px] border-white shadow-lg group-hover:scale-105 group-hover:brightness-110 transition-transform"
        />
      </span>

      <span className="hidden sm:flex flex-col items-start gap-1">
        <span className="text-xs font-bold text-white bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 whitespace-nowrap">
          @{person.username}
        </span>
        <span className={cn("text-[10px] font-bold text-white rounded-full px-2 py-0.5 whitespace-nowrap", pillColor)}>
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
  // trying to fade/tint one image into both themes -- the dark version
  // never worked well faded onto a light background, so light mode gets its
  // own art instead of a compromise.
  const bgFile = resolvedTheme === "light" ? "tree-bg-light.png" : "tree-bg.png";

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-border/60 shadow-xl bg-card"
      style={{ aspectRatio: IMAGE_ASPECT }}
    >
      <img
        src={`${import.meta.env.BASE_URL}${bgFile}`}
        alt="A glowing illustrated tree, each branch holding a teammate"
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
      />

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
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm text-center px-8">
          No one matches your search.
        </div>
      )}
    </div>
  );
}
