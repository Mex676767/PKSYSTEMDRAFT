import { useEffect, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Swords, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePkSettings, usePkViolations, useResolvePkViolation, useUpdatePkSettings } from "@/hooks/use-pk";
import type { PkSettings } from "@/lib/pk";
import { getErrorMessage } from "@/lib/utils";

type NumberKey = {
  [K in keyof PkSettings]: PkSettings[K] extends number ? K : never;
}[keyof PkSettings];
type FlagKey = "reminders_enabled" | "announce_live" | "announce_winner";

const LIMITS: { key: NumberKey; label: string }[] = [
  { key: "max_one_v_one", label: "1v1 at once" },
  { key: "max_team", label: "Team at once" },
  { key: "max_vs_upline", label: "vs Upline at once" },
  { key: "max_total", label: "Total at once" },
];
const MONEY: { key: NumberKey; label: string }[] = [
  { key: "money_limit_default", label: "Everyone else" },
  { key: "money_limit_atl_tl", label: "ATL / TL" },
  { key: "money_limit_above_tl", label: "Above TL" },
];
const OTHER: { key: NumberKey; label: string; hint: string }[] = [
  { key: "open_expiry_days", label: "Open challenge expiry (days)", hint: "Open challenges nobody takes are closed after this" },
  { key: "max_counter_rounds", label: "Counter-proposals per PK", hint: "How many times terms can be countered" },
];
const FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: "reminders_enabled", label: "Missed-update reminders", hint: "Reminder, then a warning, then a violation at 3 misses" },
  { key: "announce_live", label: "Announce new PKs", hint: "Tell the department when a PK is approved" },
  { key: "announce_winner", label: "Announce winners", hint: "Tell the department when a PK settles" },
];

/** Admin: PK limits, PK Money allowances, automation switches and violations. */
export function AdminPkCard() {
  const { data: settings } = usePkSettings();
  const update = useUpdatePkSettings();
  const { data: violations = [] } = usePkViolations(true);
  const resolve = useResolvePkViolation();
  const [draft, setDraft] = useState<Partial<Record<NumberKey, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const next: Partial<Record<NumberKey, string>> = {};
    for (const { key } of [...LIMITS, ...MONEY, ...OTHER]) next[key] = String(Number(settings[key]));
    setDraft(next);
  }, [settings]);

  if (!settings) return null;

  const changed = [...LIMITS, ...MONEY, ...OTHER].filter(({ key }) => draft[key] !== undefined && Number(draft[key]) !== Number(settings[key]));
  const save = async () => {
    setError(null);
    setSaved(false);
    if (changed.some(({ key }) => draft[key] === "" || Number.isNaN(Number(draft[key])))) return setError("Fill in every number.");
    try {
      await update.mutateAsync(Object.fromEntries(changed.map(({ key }) => [key, Number(draft[key])])));
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };
  const toggle = async (key: FlagKey, value: boolean) => {
    setError(null);
    try { await update.mutateAsync({ [key]: value }); } catch (err) { setError(getErrorMessage(err)); }
  };

  const numberField = (key: NumberKey, label: string, prefix?: string) => (
    <div key={key} className="space-y-1">
      <Label htmlFor={`pk-${key}`} className="text-xs">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input id={`pk-${key}`} type="number" min={0} inputMode="numeric" className={prefix ? "pl-11" : undefined}
          value={draft[key] ?? ""} onChange={(e) => { setSaved(false); setDraft({ ...draft, [key]: e.target.value }); }} />
      </div>
    </div>
  );

  const open = violations.filter((v) => !v.resolved_at);
  const closed = violations.filter((v) => v.resolved_at).slice(0, 5);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Swords className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">PK Arena</h2>
            <p className="text-xs text-muted-foreground">Limits and automation for PKs. Changes apply to new PKs and the next checks straight away.</p>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Active PKs per person</h3>
          <p className="text-[11px] text-muted-foreground">Counts PKs waiting for approval as well as live ones.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{LIMITS.map((f) => numberField(f.key, f.label))}</div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Monthly PK Money allowance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{MONEY.map((f) => numberField(f.key, f.label, "USD"))}</div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OTHER.map((f) => (
            <div key={f.key}>
              {numberField(f.key, f.label)}
              <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <Button size="sm" disabled={changed.length === 0 || update.isPending} onClick={save}>
            {update.isPending ? "Saving..." : "Save limits"}
          </Button>
          {saved && changed.length === 0 && <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
        </div>

        <section className="space-y-3 border-t border-border/50 pt-4">
          {FLAGS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
              <Switch checked={settings[f.key]} disabled={update.isPending} onCheckedChange={(v) => toggle(f.key, v)} aria-label={f.label} />
            </div>
          ))}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-sm font-medium">Violations {open.length > 0 && <span className="ml-1 text-[10px] bg-destructive text-white rounded-full px-1.5 py-0.5">{open.length}</span>}</h3>
          {open.length === 0 && <p className="text-xs text-muted-foreground">No open violations.</p>}
          {open.map((v) => (
            <div key={v.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">@{v.person?.username ?? "someone"}</span> · {v.note ?? v.kind}{" "}
                  <Link href={`/challenges/${v.challenge_id}`} className="text-xs text-secondary hover:underline">{v.challenge?.topic ?? "View PK"}</Link>
                </p>
                <span className="text-[11px] text-muted-foreground">{format(new Date(v.created_at), "MMM d, h:mm a")}</span>
              </div>
              <div className="flex gap-2">
                <Input value={notes[v.id] ?? ""} onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })} placeholder="How it was handled, e.g. excused, on leave" className="h-8 text-xs" />
                <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={resolve.isPending}
                  onClick={() => resolve.mutateAsync({ id: v.id, note: notes[v.id] ?? "" }).catch((err) => setError(getErrorMessage(err)))}>
                  Resolve
                </Button>
              </div>
            </div>
          ))}
          {closed.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Recently resolved</summary>
              <ul className="mt-2 space-y-1">
                {closed.map((v) => (
                  <li key={v.id}>@{v.person?.username ?? "someone"} on {v.challenge?.topic ?? "a PK"}: {v.resolution}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
