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

// The ellipse the branch spots are scattered around, tuned to
// public/tree-bg.png's canopy (roughly 1%-71% tall, 6%-95% wide) -- needs
// re-tuning if that image is ever swapped for a differently-shaped tree.
const CX = 50;
const CY = 36;
const RX = 43;
const RY = 33;

// Groups people by department (not role) so teammates from the same
// department land on a contiguous arc of the tree instead of scattered
// randomly -- per "space it out ... separate by department". Each
// department gets an angular slice sized to its headcount (so spacing stays
// even for everyone), with a small gap between slices for a clear visual
// break. If there are more people than comfortably fit on one ring, extra
// concentric rings are used (alternating within each department) so avatars
// never have to crowd closer together than the base spacing allows.
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

  const GAP_DEG = 9;
  const availableDeg = Math.max(90, 360 - GAP_DEG * groups.size);
  const anglePerPerson = availableDeg / n;
  const ringFractions = n <= 12 ? [0.93] : n <= 24 ? [0.68, 1] : [0.5, 0.76, 1];

  let angle = -90; // start at the top of the canopy, sweep clockwise
  for (const members of groups.values()) {
    members.forEach((person, i) => {
      const ringFrac = ringFractions[i % ringFractions.length];
      const rad = (angle * Math.PI) / 180;
      positions.set(person.id, {
        x: CX + Math.cos(rad) * RX * ringFrac,
        y: CY + Math.sin(rad) * RY * ringFrac,
      });
      angle += anglePerPerson;
    });
    angle += GAP_DEG;
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
      style={{ aspectRatio: "1 / 1" }}
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
