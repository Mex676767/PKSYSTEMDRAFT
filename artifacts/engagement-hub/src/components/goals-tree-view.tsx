import { motion } from "framer-motion";
import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import type { Goal } from "@/hooks/use-goals";
import type { DirectoryProfile } from "@/hooks/use-mentors";

// Percentage-based (x, y) anchor points, hand-picked to land on the leaf
// clusters of public/tree-bg.png -- if that image gets swapped out for a
// differently-shaped tree, these will need re-tuning to match.
const BRANCH_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 7 },
  { x: 30, y: 11 },
  { x: 70, y: 10 },
  { x: 16, y: 21 },
  { x: 84, y: 20 },
  { x: 10, y: 37 },
  { x: 90, y: 36 },
  { x: 14, y: 53 },
  { x: 86, y: 52 },
  { x: 24, y: 63 },
  { x: 76, y: 62 },
  { x: 50, y: 25 },
  { x: 38, y: 41 },
  { x: 62, y: 43 },
  { x: 50, y: 57 },
];

function personCompletion(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

// Leaves fan out above the avatar and pop in one at a time as `progress`
// crosses each one's threshold (5 leaves -> 0/20/40/60/80%), each easing in
// with a spring so a progress update visibly "grows" the cluster instead of
// just snapping to a new state. The gentle infinite rotate wobble is layered
// on top of (not instead of) that grow-in, so already-grown leaves keep a
// small breathing/sway motion rather than sitting totally static.
const LEAF_ANGLES = [-70, -35, 0, 35, 70];

function GrowingLeafCluster({ progress, size }: { progress: number; size: number }) {
  const radius = size * 0.55;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {LEAF_ANGLES.map((angle, i) => {
        const threshold = (i / LEAF_ANGLES.length) * 100;
        const grown = Math.min(1, Math.max(0, (progress - threshold) / (100 / LEAF_ANGLES.length)));
        const rad = ((angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: 15,
              height: 15,
              marginLeft: -7.5,
              marginTop: -7.5,
              background: "linear-gradient(135deg, #bef264, #4d7c0f)",
              borderRadius: "0% 100% 0% 100%",
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
            initial={false}
            animate={{
              x,
              y,
              scale: grown > 0 ? 0.55 + grown * 0.65 : 0,
              opacity: grown > 0 ? 0.9 : 0,
              rotate: [angle - 5, angle + 5, angle - 5],
            }}
            transition={{
              x: { type: "spring", stiffness: 120, damping: 14 },
              y: { type: "spring", stiffness: 120, damping: 14 },
              scale: { type: "spring", stiffness: 140, damping: 12 },
              opacity: { duration: 0.4 },
              rotate: { duration: 3.5 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        );
      })}
    </div>
  );
}

function TreePersonNode({
  person,
  goals,
  x,
  y,
  onClick,
}: {
  person: DirectoryProfile;
  goals: Goal[];
  x: number;
  y: number;
  onClick: () => void;
}) {
  const completion = personCompletion(goals);
  const size = 56;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 hover:scale-105 active:scale-95 transition-transform"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`@${person.username} -- ${completion}% of goals`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <GrowingLeafCluster progress={completion} size={size} />
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          className="w-14 h-14 border-[3px] border-white shadow-lg relative z-10"
        />
        <span className="absolute -bottom-1 -right-1 z-20 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 shadow leading-none">
          {completion}%
        </span>
      </div>
      <span className="text-[11px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] max-w-[84px] truncate">
        @{person.username}
      </span>
    </button>
  );
}

export function GoalsTreeView({
  people,
  goalsByOwner,
  onSelect,
}: {
  people: DirectoryProfile[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (person: DirectoryProfile) => void;
}) {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-xl border border-border/50 bg-[#0c1230]"
      style={{ aspectRatio: "1 / 1" }}
    >
      <img
        src={`${import.meta.env.BASE_URL}tree-bg.png`}
        alt="A glowing illustrated tree, each branch holding a teammate"
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
      />

      {people.map((person, i) => {
        // Once we run out of hand-picked branch spots, cycle back through
        // them with a small vertical nudge per lap so repeats don't stack
        // exactly on top of each other.
        const pos = BRANCH_POSITIONS[i % BRANCH_POSITIONS.length];
        const lap = Math.floor(i / BRANCH_POSITIONS.length);
        return (
          <TreePersonNode
            key={person.id}
            person={person}
            goals={goalsByOwner.get(person.id) ?? []}
            x={pos.x}
            y={Math.min(96, pos.y + lap * 3)}
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
