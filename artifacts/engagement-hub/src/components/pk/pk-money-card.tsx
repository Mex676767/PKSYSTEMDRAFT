import { Link } from "wouter";
import { format } from "date-fns";
import { Check, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useMarkPkPaid, usePkMoney } from "@/hooks/use-pk";
import { formatPkNumber } from "@/lib/pk";
import { cn } from "@/lib/utils";

/** This month's PK Money allowance and who owes whom. Tracked only. */
export function PkMoneyCard() {
  const { session } = useAuth();
  const { data } = usePkMoney();
  const mark = useMarkPkPaid();
  if (!data?.summary) return null;
  const s = data.summary;
  const me = session?.user.id;
  const pct = s.allowance > 0 ? Math.min(100, (100 * s.used) / s.allowance) : 0;
  const open = data.debts.filter((d) => !d.paid_at);
  const recent = data.debts.filter((d) => d.paid_at).slice(0, 3);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-amber-500" /> PK Money · {format(new Date(s.month_start + "T00:00:00"), "MMMM")}</p>
          <span className="text-[11px] text-muted-foreground">Tracked only, paid outside the app</span>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>USD {formatPkNumber(s.used)} of {formatPkNumber(s.allowance)} staked</span>
            <span className="font-medium">USD {formatPkNumber(s.remaining)} left</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="meter" aria-valuenow={s.used} aria-valuemin={0} aria-valuemax={s.allowance} aria-label="PK Money used this month">
            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-amber-500")} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <p className="text-[11px] text-muted-foreground">Owed to you</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">USD {formatPkNumber(s.owed_to_me)}</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-2">
            <p className="text-[11px] text-muted-foreground">You owe</p>
            <p className="font-bold text-destructive">USD {formatPkNumber(s.i_owe)}</p>
          </div>
        </div>
        {[...open, ...recent].length > 0 && (
          <ul className="space-y-1.5">
            {[...open, ...recent].map((d) => {
              const owedToMe = d.creditor_id === me;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    {owedToMe ? `@${d.debtor?.username ?? "someone"} owes you` : `You owe @${d.creditor?.username ?? "someone"}`}{" "}
                    <span className="font-semibold">USD {formatPkNumber(d.amount)}</span>
                    {d.challenge?.topic && <Link href={`/challenges/${d.challenge_id}`} className="text-xs text-muted-foreground hover:underline ml-1.5">{d.challenge.topic}</Link>}
                  </span>
                  {d.paid_at ? (
                    <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Received</span>
                  ) : owedToMe ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={mark.isPending} onClick={() => mark.mutate({ id: d.id, paid: true })}>Mark received</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not paid yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
