import { Crown } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { initialsForUsername, colorForId } from "@/hooks/use-auth";
import type { HofPodiumEntry } from "@/hooks/use-hall-of-fame";
import { cn } from "@/lib/utils";

const STAND_META: Record<number, { order: string; height: string; ring: string; medal: string; avatar: string }> = {
  1: { order: "order-2", height: "h-24", ring: "ring-2 ring-amber-400", medal: "🥇", avatar: "w-14 h-14" },
  2: { order: "order-1", height: "h-16", ring: "ring-2 ring-zinc-300", medal: "🥈", avatar: "w-11 h-11" },
  3: { order: "order-3", height: "h-11", ring: "ring-2 ring-amber-700/60", medal: "🥉", avatar: "w-11 h-11" },
};

function PodiumStand({ entry }: { entry: HofPodiumEntry }) {
  const meta = STAND_META[entry.rank] ?? STAND_META[3];
  return (
    <div className={cn("flex flex-col items-center gap-1.5 flex-1 min-w-0", meta.order)}>
      <span className="text-xl leading-none">{meta.medal}</span>
      <UserAvatar
        user={{ name: entry.username ?? "unknown", initials: initialsForUsername(entry.username ?? "?"), color: colorForId(entry.user_id) }}
        photoUrl={entry.avatar_url}
        border={entry.active_border}
        className={cn(meta.avatar, meta.ring, "shrink-0")}
      />
      <p className="text-xs font-semibold truncate max-w-full">@{entry.username ?? "unknown"}</p>
      <p className="text-[10px] text-muted-foreground">{entry.total_points.toLocaleString()} pts</p>
      <div className={cn("w-full rounded-t-md bg-gradient-to-b from-accent/40 to-accent/10", meta.height)} />
    </div>
  );
}

export function DepartmentPodium({ department, entries }: { department: string; entries: HofPodiumEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5">
        <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
          <Crown className="w-4 h-4 text-muted-foreground" /> {department}
        </h3>
        <p className="text-xs text-muted-foreground text-center py-6">No points earned yet this month.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 via-card to-card p-5 shadow-sm">
      <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-4">
        <Crown className="w-4 h-4 text-accent" /> {department}
      </h3>
      <div className="flex items-end justify-center gap-3 px-2">
        {entries.map((entry) => (
          <PodiumStand key={entry.user_id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
