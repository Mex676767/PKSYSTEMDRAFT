import { UserAvatar } from "@/components/user-avatar";
import { initialsForUsername, colorForId } from "@/hooks/use-auth";
import type { HofPodiumEntry } from "@/hooks/use-hall-of-fame";
import { cn } from "@/lib/utils";

const places = ["", "First place", "Second place", "Third place"];

export function DepartmentPodium({ department, entries, monthLabel }: { department: string; entries: HofPodiumEntry[]; monthLabel?: string }) {
  return (
    <section aria-label={`${department} podium`} className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card px-3 py-7 sm:p-8 shadow-sm">
      <header className="text-center space-y-3">
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.23em] uppercase text-primary">✦ Monthly achievement spotlight</p>
        <h2 className="text-xl sm:text-2xl font-bold">{department}{monthLabel && ` · ${monthLabel}`}</h2>
        <p className="text-sm text-muted-foreground">A moment for this month's standouts.</p>
      </header>
      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No points earned in this department this month.</p>
      ) : (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 max-w-3xl mx-auto mt-10 sm:mt-14">
          {[2, 1, 3].map(rank => {
            const entry = entries.find(person => person.rank === rank);
            const winner = rank === 1;
            return (
              <div key={rank} className={cn("min-w-0 rounded-t-2xl border flex flex-col items-center text-center px-1.5 sm:px-5 py-6 sm:py-9 gap-4", winner ? "min-h-72 sm:min-h-80 border-amber-300/80 bg-gradient-to-b from-amber-200/25 via-primary/15 to-primary/5 shadow-[0_0_36px_-12px_rgba(251,191,36,0.5)]" : "min-h-60 sm:min-h-72 border-primary/35 bg-gradient-to-b from-primary/20 to-primary/5")}>
                <span aria-hidden="true" className="text-2xl">{winner ? "👑" : rank === 2 ? "🥈" : "🥉"}</span>
                {entry ? <>
                  <div className="py-2 flex justify-center w-full">
                    <UserAvatar user={{ name: entry.username ?? "Team member", initials: initialsForUsername(entry.username ?? "?"), color: colorForId(entry.user_id) }} photoUrl={entry.avatar_url} border={entry.active_border} className={cn(winner ? "w-14 h-14 sm:w-20 sm:h-20 ring-2 ring-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.6)]" : "w-11 h-11 sm:w-16 sm:h-16 ring-2 ring-primary/60", "text-lg sm:text-2xl")} />
                  </div>
                  <div className="w-full space-y-1"><p className="font-bold text-xs sm:text-base break-words">{entry.username ?? "Team member"}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{places[rank]}</p></div>
                  <p className="font-bold text-amber-600 dark:text-amber-300 text-base sm:text-xl">{entry.total_points.toLocaleString()} <span className="text-[10px] font-normal">pts</span></p>
                </> : <div className="my-auto text-xs text-muted-foreground"><p>{places[rank]}</p><p className="mt-2">Unclaimed</p></div>}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">Ranked by points earned during the selected month.</p>
    </section>
  );
}
