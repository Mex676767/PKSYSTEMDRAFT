import { useMemo, useState } from "react";
import { Crown, Flame, Medal, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { SearchableSelect } from "@/components/searchable-select";
import { colorForId, initialsForUsername, useAuth } from "@/hooks/use-auth";
import { useOrgStructure } from "@/hooks/use-org-structure";
import { usePkLeaderboard, usePkSettings } from "@/hooks/use-pk";
import { formatPkNumber, monthLabel, recentMonths, type PkLeaderRow } from "@/lib/pk";
import { cn } from "@/lib/utils";

const COMBINED = "Marketing + Retention + Designer";

function Avatar({ row, className }: { row: Pick<PkLeaderRow, "user_id" | "username" | "avatar_url" | "active_border" | "active_accessory">; className?: string }) {
  const name = row.username ?? "unknown";
  return <UserAvatar user={{ name, initials: initialsForUsername(name), color: colorForId(row.user_id) }} photoUrl={row.avatar_url}
    border={row.active_border} accessory={row.active_accessory} className={cn("w-8 h-8 text-[10px] shrink-0", className)} />;
}

/** Monthly v3.43 season: top three, bottom two and a live full table. */
export function PkLeaderboard() {
  const { profile } = useAuth();
  const { departments } = useOrgStructure();
  const months = recentMonths(12);
  const [period, setPeriod] = useState(months[0]);
  const [dept, setDept] = useState<string>(profile?.department ?? "");
  const { data: rows = [], isLoading } = usePkLeaderboard(period, dept || null);
  const { data: settings } = usePkSettings();
  const top = rows.slice(0, 3);
  const bottom = useMemo(() => [...rows].sort((a, b) => Number(b.played === 0) - Number(a.played === 0) || a.points - b.points || a.played - b.played).slice(0, 2), [rows]);

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">
      <div className="w-48"><SearchableSelect value={period} onValueChange={setPeriod} searchable={false} aria-label="Month"
        options={months.map((m, i) => ({ value: m, label: monthLabel(m), description: i === 0 ? "Current season" : undefined }))} /></div>
      <div className="w-64"><SearchableSelect value={dept} onValueChange={setDept} aria-label="Ranking group" searchPlaceholder="Search groups..."
        options={[{ value: "", label: "Company ranking" }, { value: COMBINED, label: COMBINED }, ...departments.map((d) => ({ value: d, label: d }))]} /></div>
    </div>

    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-fuchsia-500/5">
      <CardContent className="p-5 space-y-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5"><Crown className="w-4 h-4" /> Monthly PK ranking · {monthLabel(period)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">PK points are separate from reward points. Rankings update as soon as a result is confirmed.</p></div>
        <div className="grid sm:grid-cols-3 gap-3">
          {top.map((r, i) => <div key={r.user_id} className={cn("rounded-xl border p-3 flex items-center gap-3", i === 0 && "border-amber-500/50 bg-amber-500/5")}>
            <span className="text-lg">{["🥇", "🥈", "🥉"][i]}</span><Avatar row={r} className="w-10 h-10" /><div className="min-w-0"><p className="font-semibold truncate">@{r.username}</p><p className="text-xs text-muted-foreground">{formatPkNumber(r.points)} pts · {r.wins}W</p></div>
          </div>)}
          {!isLoading && top.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-3">No people in this ranking group.</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 border-t border-border/50 pt-4">
          <div className="text-sm"><p className="font-medium flex items-center gap-1.5"><Medal className="w-4 h-4 text-secondary" /> Monthly prize</p><p className="text-xs text-muted-foreground mt-1">PIC: {settings?.prize_pic ?? "Ken"} · Amount: {settings?.prize_amount ?? "TBA"}</p></div>
          <div className="text-sm"><p className="font-medium flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-destructive" /> Bottom two</p><p className="text-xs text-muted-foreground mt-1">PIC: {settings?.penalty_pic ?? "Ken"} · {settings?.penalty_notice ?? "Announced in advance"}. Never a salary or KPI deduction.</p>
            {bottom.length > 0 && <p className="text-xs mt-1">{bottom.map((r) => `@${r.username}${r.played === 0 ? " (no matches)" : ""}`).join(" · ")}</p>}</div>
        </div>
      </CardContent>
    </Card>

    <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[11px] text-muted-foreground text-left border-b border-border">
      <th className="font-normal px-4 py-2 w-10">#</th><th className="font-normal py-2">Who</th><th className="font-normal py-2 text-right">Points</th><th className="font-normal py-2 text-right hidden sm:table-cell">W</th><th className="font-normal py-2 text-right hidden sm:table-cell">L</th><th className="font-normal py-2 text-right hidden sm:table-cell">D</th><th className="font-normal py-2 text-right">Win %</th><th className="font-normal py-2 text-right hidden sm:table-cell">Played</th><th className="font-normal py-2 px-4 text-right">Streak</th>
    </tr></thead><tbody>
      {isLoading ? <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr> : rows.map((r) => <tr key={r.user_id} className={cn("border-b border-border/50 last:border-0", r.user_id === profile?.id && "bg-secondary/5")}>
        <td className="px-4 py-2 font-bold tabular-nums">{r.rank === 1 ? <Crown className="w-4 h-4 text-amber-500" /> : r.rank}</td>
        <td className="py-2"><div className="flex items-center gap-2 min-w-0"><Avatar row={r} /><div className="min-w-0"><p className="font-medium truncate">@{r.username}</p><p className="text-[10px] text-muted-foreground truncate">{[r.role, r.department].filter(Boolean).join(" · ")}</p></div></div></td>
        <td className={cn("py-2 text-right font-bold tabular-nums", r.points < 0 && "text-destructive")}>{formatPkNumber(r.points)}</td><td className="py-2 text-right hidden sm:table-cell">{r.wins}</td><td className="py-2 text-right hidden sm:table-cell">{r.losses}</td><td className="py-2 text-right hidden sm:table-cell">{r.draws}</td><td className="py-2 text-right">{r.win_pct ?? 0}%</td><td className="py-2 text-right hidden sm:table-cell">{r.played}</td><td className="py-2 px-4 text-right">{r.streak > 0 ? <span className="inline-flex items-center gap-0.5 text-orange-500"><Flame className="w-3.5 h-3.5" />{r.streak}</span> : "–"}</td>
      </tr>)}
    </tbody></table></CardContent></Card>
    <p className="text-[11px] text-muted-foreground">Winner points use the approved 5 / 8 / 10 tier. Each consecutive win adds 5%; beating a 3+ streak adds that opponent's streak percentage. Bonuses currently combine additively. A completed loss earns 1 point.</p>
  </div>;
}
