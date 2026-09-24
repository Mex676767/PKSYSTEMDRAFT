import { useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { Coins, Target, ShoppingBag, History, CheckCircle2, Clock, XCircle, Gift, Package } from "lucide-react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  useClaimMission,
  useFullPointHistory,
  useMyMissions,
  useMyRedemptions,
  usePointsSettings,
  useRedeemReward,
  useRewards,
  type MyMission,
  type Reward,
} from "@/hooks/use-rewards";
import { CADENCE_LABEL, missionUnit, type MissionCadence } from "@/lib/missions";
import { cn, getErrorMessage } from "@/lib/utils";

type Tab = "missions" | "shop" | "history";

const TABS: { key: Tab; label: string; icon: typeof Target }[] = [
  { key: "missions", label: "Missions", icon: Target },
  { key: "shop", label: "Rewards Shop", icon: ShoppingBag },
  { key: "history", label: "History", icon: History },
];

export default function Rewards() {
  const { profile } = useAuth();
  const { data: settings, isLoading } = usePointsSettings();
  const [tab, setTab] = useState<Tab>("missions");

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-primary/15 text-primary p-3 rounded-2xl">
            <Coins className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Rewards</h1>
            <p className="text-muted-foreground">Complete missions, earn points, treat yourself.</p>
          </div>
        </div>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/15 to-card shrink-0">
          <CardContent className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Your balance</p>
            <p className="text-2xl font-bold tabular-nums">{(profile?.points ?? 0).toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">pts</span></p>
          </CardContent>
        </Card>
      </div>

      {!settings?.revamp_enabled ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Missions and the rewards shop aren't open right now. Check back soon!
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
                  tab === key
                    ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-md"
                    : "border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {tab === "missions" && <MissionsTab />}
          {tab === "shop" && <ShopTab balance={profile?.points ?? 0} />}
          {tab === "history" && <HistoryTab />}
        </>
      )}
    </PageTransition>
  );
}

function MissionsTab() {
  const { data: missions = [], isLoading } = useMyMissions(true);
  const claim = useClaimMission();
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  if (missions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">No missions right now. Check back soon!</p>;
  }

  const groups = (["daily", "weekly", "monthly", "special"] as MissionCadence[])
    .map((c) => ({ cadence: c, items: missions.filter((m) => m.cadence === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.cadence} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {CADENCE_LABEL[g.cadence]} missions
            {g.cadence !== "special" && g.items[0].resets_at && (
              <span className="text-xs font-normal text-muted-foreground">
                · resets in {formatDistanceToNowStrict(new Date(g.items[0].resets_at))}
              </span>
            )}
          </h2>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
            {g.items.map((m) => (
              <motion.div key={m.id} variants={slideUp}>
                <MissionCard
                  mission={m}
                  busy={claim.isPending && claim.variables === m.id}
                  error={error?.id === m.id ? error.message : null}
                  onClaim={() => {
                    setError(null);
                    claim.mutate(m.id, { onError: (e) => setError({ id: m.id, message: getErrorMessage(e) }) });
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      ))}
    </div>
  );
}

function MissionCard({ mission: m, busy, error, onClaim }: { mission: MyMission; busy: boolean; error: string | null; onClaim: () => void }) {
  const manual = m.kind === "manual";
  const done = m.claim_status === "awarded";
  const ready = !manual && m.progress >= m.target_count;
  const pct = manual ? (done ? 100 : 0) : Math.round((m.progress / m.target_count) * 100);

  return (
    <Card className={cn("h-full shadow-sm", done && "border-emerald-500/40 bg-emerald-500/5")}>
      <CardContent className="p-4 space-y-3 h-full flex flex-col">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug">{m.title}</p>
            {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
          </div>
          <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-primary/15 text-primary">+{m.points} pts</span>
        </div>

        {!manual && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", done ? "bg-emerald-500" : "bg-gradient-to-r from-fuchsia-500 to-purple-600")} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {m.progress} / {m.target_count} {missionUnit(m.kind, m.target_count)}
            </p>
          </div>
        )}

        {m.cadence === "special" && m.ends_at && (
          <p className="text-[11px] text-muted-foreground">Ends {format(new Date(m.ends_at), "d MMM, h:mm a")}</p>
        )}

        <div className="mt-auto pt-1">
          {done ? (
            <p className="text-sm font-semibold text-emerald-500 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Claimed</p>
          ) : m.claim_status === "pending" ? (
            <p className="text-sm font-semibold text-amber-500 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Waiting for admin approval</p>
          ) : manual ? (
            <div className="space-y-1.5">
              {m.claim_status === "rejected" && (
                <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Not approved last time; you can submit again.</p>
              )}
              <Button size="sm" variant="outline" onClick={onClaim} disabled={busy} className="w-full">
                {busy ? "Submitting..." : "I did this, submit for approval"}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onClaim} disabled={!ready || busy} className="w-full">
              {busy ? "Claiming..." : ready ? `Claim ${m.points} pts` : "In progress"}
            </Button>
          )}
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ShopTab({ balance }: { balance: number }) {
  const { data: rewards = [], isLoading } = useRewards();
  const redeem = useRedeemReward();
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const available = rewards.filter((r) => r.active);

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  if (available.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">The shop is empty for now.</p>;

  return (
    <>
      {redeemed && (
        <p className="text-sm rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-2">
          Redeemed “{redeemed}”. An admin will confirm it soon; you'll get a notification. If it's declined your points come back.
        </p>
      )}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((r) => {
          const soldOut = r.stock !== null && r.stock <= 0;
          const short = balance < r.cost;
          return (
            <motion.div key={r.id} variants={slideUp}>
              <Card className="h-full shadow-sm">
                <CardContent className="p-4 h-full flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0"><Gift className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{r.name}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-base font-bold text-foreground tabular-nums">{r.cost.toLocaleString()} pts</span>
                    {r.stock !== null && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {soldOut ? "Sold out" : `${r.stock} left`}</span>}
                  </div>
                  <Button size="sm" disabled={soldOut || short} onClick={() => { setError(null); setConfirming(r); }}>
                    {soldOut ? "Sold out" : short ? `Need ${(r.cost - balance).toLocaleString()} more pts` : "Redeem"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redeem “{confirming?.name}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirming?.cost.toLocaleString()} pts will be taken from your balance now ({balance.toLocaleString()} → {(balance - (confirming?.cost ?? 0)).toLocaleString()}).
            An admin then confirms it; if it's declined, the points are refunded.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              disabled={redeem.isPending}
              onClick={() =>
                confirming &&
                redeem.mutate(confirming.id, {
                  onSuccess: () => { setRedeemed(confirming.name); setConfirming(null); },
                  onError: (e) => setError(getErrorMessage(e)),
                })
              }
            >
              {redeem.isPending ? "Redeeming..." : "Redeem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const REDEMPTION_STATUS = {
  pending: { label: "Waiting for approval", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  fulfilled: { label: "Approved", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Declined · refunded", className: "bg-destructive/15 text-destructive" },
} as const;

function HistoryTab() {
  const { data: redemptions = [] } = useMyRedemptions();
  const { data: ledger = [] } = useFullPointHistory();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My rewards</h2>
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't redeemed anything yet.</p>
        ) : (
          <div className="space-y-2">
            {redemptions.map((d) => (
              <Card key={d.id} className="shadow-sm">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{d.reward_name}</span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", REDEMPTION_STATUS[d.status].className)}>
                      {REDEMPTION_STATUS[d.status].label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{d.cost.toLocaleString()} pts · {format(new Date(d.created_at), "d MMM yyyy")}</p>
                  {d.admin_note && <p className="text-xs text-muted-foreground italic">“{d.admin_note}”</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Points history</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No points activity yet.</p>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-0 divide-y divide-border">
              {ledger.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.reason}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), "d MMM yyyy, h:mm a")}</p>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums", t.amount >= 0 ? "text-emerald-500" : "text-destructive")}>
                    {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
