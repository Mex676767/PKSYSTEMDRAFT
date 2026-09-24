import { useState } from "react";
import { Crown, Flame, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { SearchableSelect } from "@/components/searchable-select";
import { colorForId, initialsForUsername, useAuth } from "@/hooks/use-auth";
import { useOrgStructure } from "@/hooks/use-org-structure";
import { usePkChampions, usePkLeaderboard } from "@/hooks/use-pk";
import { formatPkNumber, quarterLabel, recentQuarters, type PkChampion, type PkLeaderRow } from "@/lib/pk";
import { cn } from "@/lib/utils";

function Avatar({ row, className }: { row: Pick<PkLeaderRow, "user_id" | "username" | "avatar_url" | "active_border" | "active_accessory">; className?: string }) {
  const name = row.username ?? "unknown";
  return (
    <UserAvatar
      user={{ name, initials: initialsForUsername(name), color: colorForId(row.user_id) }}
      photoUrl={row.avatar_url}
      border={row.active_border}
      accessory={row.active_accessory}
      className={cn("w-8 h-8 text-[10px] shrink-0", className)}
    />
  );
}

/** Quarterly PK leaderboard with the department's King / Queen and past champions. */
export function PkLeaderboard() {
  const { profile } = useAuth();
  const { departments } = useOrgStructure();
  const quarters = recentQuarters(8);
  const [period, setPeriod] = useState(quarters[0]);
  const [dept, setDept] = useState<string>(profile?.department ?? "");
  const { data: rows = [], isLoading } = usePkLeaderboard(period, dept || null);
  const { data: champions = [] } = usePkChampions(dept || null);

  const current = period === quarters[0];
  const kings = rows.filter((r) => r.rank === 1 && r.points > 0);
  const past = champions.filter((c) => c.period_start !== quarters[0]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <div className="w-40">
          <SearchableSelect value={period} onValueChange={setPeriod} searchable={false} aria-label="Quarter"
            options={quarters.map((q, i) => ({ value: q, label: quarterLabel(q), description: i === 0 ? "This quarter" : undefined }))} />
        </div>
        <div className="w-56">
          <SearchableSelect value={dept} onValueChange={setDept} aria-label="Department" searchPlaceholder="Search departments..."
            options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]} />
        </div>
      </div>

      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Crown className="w-4 h-4" /> PK King / Queen · {quarterLabel(period)}{current && " so far"}
          </p>
          {kings.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">No champion yet. Win a PK to take the crown.</p>
          ) : (
            <div className="flex flex-wrap gap-4 mt-3">
              {kings.map((k) => (
                <div key={`${k.department}-${k.user_id}`} className="flex items-center gap-3">
                  <Avatar row={k} className="w-12 h-12 text-sm" />
                  <div>
                    <p className="font-bold">@{k.username}</p>
                    <p className="text-xs text-muted-foreground">{k.department} · {formatPkNumber(k.points)} pts · {k.wins}W</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">Win +3.5, loss −0.5, draw +0.5. Points reset every quarter and never touch reward points.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground text-left border-b border-border">
                <th className="font-normal px-4 py-2 w-10">#</th>
                <th className="font-normal py-2">Who</th>
                <th className="font-normal py-2 text-right">Points</th>
                <th className="font-normal py-2 text-right hidden sm:table-cell">W</th>
                <th className="font-normal py-2 text-right hidden sm:table-cell">L</th>
                <th className="font-normal py-2 text-right hidden sm:table-cell">D</th>
                <th className="font-normal py-2 text-right">Win %</th>
                <th className="font-normal py-2 text-right hidden sm:table-cell">Played</th>
                <th className="font-normal py-2 px-4 text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">No settled PKs in {quarterLabel(period)}{dept && ` for ${dept}`} yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={`${r.department}-${r.user_id}`} className={cn("border-b border-border/50 last:border-0", r.user_id === profile?.id && "bg-secondary/5")}>
                  <td className="px-4 py-2 font-bold tabular-nums">{r.rank === 1 && r.points > 0 ? <Crown className="w-4 h-4 text-amber-500" /> : r.rank}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar row={r} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">@{r.username}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{[r.role, !dept && r.department].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cn("py-2 text-right font-bold tabular-nums", r.points < 0 && "text-destructive")}>{formatPkNumber(r.points)}</td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">{r.wins}</td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">{r.losses}</td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">{r.draws}</td>
                  <td className="py-2 text-right tabular-nums">{r.win_pct ?? 0}%</td>
                  <td className="py-2 text-right tabular-nums hidden sm:table-cell">{r.played}</td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {r.streak > 0 ? <span className="inline-flex items-center gap-0.5 text-orange-500"><Flame className="w-3.5 h-3.5" />{r.streak}</span> : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><History className="w-4 h-4 text-secondary" /> Past champions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {past.map((c: PkChampion) => (
              <div key={`${c.period_start}-${c.department}-${c.user_id}`} className="flex items-center gap-3 rounded-lg border p-2.5">
                <Avatar row={c} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">@{c.username}</p>
                  <p className="text-[11px] text-muted-foreground">{quarterLabel(c.period_start)} · {c.department} · {formatPkNumber(c.points)} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
