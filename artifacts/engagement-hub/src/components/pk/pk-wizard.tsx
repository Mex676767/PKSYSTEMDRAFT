import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, Crown, Plus, Swords, Users, UserRound, Megaphone, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { SearchableSelect } from "@/components/searchable-select";
import { personOption } from "@/components/person-option";
import { useAuth } from "@/hooks/use-auth";
import { useDirectory } from "@/hooks/use-mentors";
import { useCreatePk, useRespondPk } from "@/hooks/use-pk";
import { PK_SCORING_HINT, PK_SCORING_LABEL, PK_UPDATE_FREQUENCIES, type Pk, type PkScoring, type PkTerms } from "@/lib/pk";
import { cn, getErrorMessage } from "@/lib/utils";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft-storage";

const DRAFT_KEY = "c9myr:new-pk-draft";
const MAX_TEAM = 5;

function blankTerms(): PkTerms {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    method: "named", format: "head_to_head", team: false,
    title: "", description: "", metric: "", metric_definition: "", direction: "higher", scoring: "absolute",
    winning_target: "", starts_at: today, ends_at: "", update_frequency: "Daily", reward: "", punishment: "",
    pk_money: "", proof_method: "", tiebreaker: "", compliance_agreed: false,
    creator: { baseline: "", target: "" },
    participants: [{ user_id: "", side: "B", is_captain: true, baseline: "", target: "" }],
  };
}

const STEPS = ["Type", "Who", "Metric", "Numbers", "Stakes", "Review"] as const;

/**
 * Create a PK, or (with `counterOf`) counter-propose on one. Counters keep the
 * type and the people fixed and let the captain change everything else.
 */
export function PkWizard({
  open,
  onOpenChange,
  counterOf,
  initial,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counterOf?: Pk;
  initial?: PkTerms;
  onDone?: (id: string | null) => void;
}) {
  const { session, profile } = useAuth();
  const { data: directory = [] } = useDirectory();
  const create = useCreatePk();
  const respond = useRespondPk();
  const isCounter = !!counterOf;
  const [t, setT] = useState<PkTerms>(() => initial ?? blankTerms());
  const [step, setStep] = useState(isCounter ? 2 : 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (isCounter) {
      setT(initial ?? blankTerms());
      setStep(2);
    } else {
      const draft = loadDraft<PkTerms>(DRAFT_KEY);
      setT(draft ? { ...blankTerms(), ...draft } : blankTerms());
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && !isCounter) saveDraft(DRAFT_KEY, t);
  }, [open, isCounter, t]);

  const me = session?.user.id;
  const myDept = profile?.department ?? null;
  const colleagues = useMemo(
    () => directory.filter((p) => p.id !== me && p.department === myDept),
    [directory, me, myDept],
  );
  const nameOf = (id: string) => directory.find((p) => p.id === id)?.username ?? "someone";

  const set = <K extends keyof PkTerms>(key: K, value: PkTerms[K]) => setT((prev) => ({ ...prev, [key]: value }));
  const isSelf = t.format === "self_declaration";
  const needsBaseline = isSelf || t.scoring === "improvement";
  const needsTarget = isSelf || t.scoring === "completion";
  const sideA = t.participants.filter((p) => p.side === "A");
  const sideB = t.participants.filter((p) => p.side === "B");
  const taken = new Set([me, ...t.participants.map((p) => p.user_id)].filter(Boolean) as string[]);

  const setPerson = (index: number, patch: Partial<PkTerms["participants"][number]>) =>
    set("participants", t.participants.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const addPerson = (side: "A" | "B") =>
    set("participants", [...t.participants, { user_id: "", side, is_captain: side === "B" && sideB.length === 0, baseline: "", target: "" }]);
  const removePerson = (index: number) => set("participants", t.participants.filter((_, i) => i !== index));

  const chooseType = (patch: Partial<PkTerms>) => {
    const next = { ...t, ...patch };
    if (next.method === "open" || next.format === "self_declaration") next.team = false;
    if (next.format === "self_declaration") next.scoring = null;
    else if (!next.scoring) next.scoring = "absolute";
    if (next.method === "open") next.participants = [];
    else if (!next.team) {
      const opp = next.participants.find((p) => p.side === "B");
      next.participants = [{ user_id: opp?.user_id ?? "", side: "B", is_captain: true, baseline: opp?.baseline ?? "", target: opp?.target ?? "" }];
    }
    setT(next);
  };

  // Light checks per step; the database does the real validation.
  const stepProblem = (): string | null => {
    if (step === 1 && t.method === "named") {
      if (t.participants.some((p) => !p.user_id)) return "Pick everyone, or remove the empty slots.";
      if (sideB.length === 0) return "Choose who you're challenging.";
      if (t.team && (sideA.length + 1 < 2 || sideA.length + 1 !== sideB.length)) return "Teams need 2 to 5 people each, same size on both sides.";
    }
    if (step === 2) {
      if (!t.title.trim()) return "Give it a title.";
      if (!t.metric.trim() || !t.metric_definition.trim()) return "Say what's measured and exactly how it's counted.";
      if (!t.proof_method.trim()) return "Say what counts as proof.";
    }
    if (step === 3) {
      if (needsBaseline && !t.creator.baseline) return "Fill in your baseline.";
      if (needsTarget && !t.creator.target) return "Fill in your target.";
      if (!isSelf && t.participants.some((p) => (needsBaseline && !p.baseline) || (needsTarget && !p.target))) {
        return "Fill in everyone's numbers.";
      }
    }
    if (step === 4 && !t.ends_at) return "Pick an end date.";
    return null;
  };

  const next = () => {
    const problem = stepProblem();
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!t.compliance_agreed) return setError("Tick the fair-play box first.");
    setError(null);
    try {
      if (counterOf) {
        const everyone = [{ user_id: counterOf.creator_id, side: "A" as const, is_captain: true, ...t.creator }, ...t.participants];
        await respond.mutateAsync({ id: counterOf.id, response: "counter", counter: { ...t, participants: everyone } });
        onDone?.(counterOf.id);
      } else {
        const id = await create.mutateAsync(t);
        clearDraft(DRAFT_KEY);
        onDone?.(id);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const busy = create.isPending || respond.isPending;
  const firstStep = isCounter ? 2 : 0;
  const input = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const tomorrow = format(new Date(Date.now() + 86_400_000), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const personPicker = (index: number, label: string) => {
    const p = t.participants[index];
    return (
      <div key={index} className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchableSelect
            value={p.user_id}
            onValueChange={(v) => setPerson(index, { user_id: v })}
            options={colleagues.filter((c) => c.id === p.user_id || !taken.has(c.id)).map(personOption)}
            placeholder={label}
            searchPlaceholder="Search your department..."
            emptyText={myDept ? `Nobody else in ${myDept}` : "Set your department first"}
            aria-label={label}
          />
        </div>
        {t.team && p.side === "B" && (
          <button type="button" title="Make captain" onClick={() => set("participants", t.participants.map((q, i) => q.side === "B" ? { ...q, is_captain: i === index } : q))}
            className={cn("p-2 rounded-md border", p.is_captain ? "text-amber-500 border-amber-500/50" : "text-muted-foreground")}>
            <Crown className="w-4 h-4" />
          </button>
        )}
        {t.team && (
          <button type="button" title="Remove" onClick={() => removePerson(index)} className="p-2 text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  const numberRow = (label: string, values: { baseline: string; target: string }, onChange: (patch: { baseline?: string; target?: string }) => void) => (
    <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
      <span className="text-sm truncate">{label}</span>
      {needsBaseline && (
        <input type="number" inputMode="decimal" className={cn(input, "w-28")} placeholder="Baseline" value={values.baseline}
          onChange={(e) => onChange({ baseline: e.target.value })} />
      )}
      {needsTarget && (
        <input type="number" inputMode="decimal" className={cn(input, "w-28")} placeholder="Target" value={values.target}
          onChange={(e) => onChange({ target: e.target.value })} />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-secondary" /> {isCounter ? "Counter-propose" : "Start a PK"}
          </DialogTitle>
          <DialogDescription>
            {isCounter ? "Change the terms you don't agree with. Everyone else will need to accept again." : "Set the terms. Your opponent can accept, counter or decline."}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground" aria-label="Steps">
          {STEPS.map((name, i) => (
            <li key={name} className={cn("flex-1 text-center", i < firstStep && "hidden")}>
              <div className={cn("h-1 rounded-full mb-1", i <= step ? "bg-secondary" : "bg-muted")} />
              <span className={cn(i === step && "text-foreground")}>{name}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 py-1">
          {step === 0 && (
            <>
              <Field label="How do you want to find an opponent?">
                <div className="grid grid-cols-2 gap-2">
                  <Choice active={t.method === "named"} onClick={() => chooseType({ method: "named" })} icon={<UserRound className="w-4 h-4" />}
                    title="Challenge someone" text="Pick who you're up against." />
                  <Choice active={t.method === "open"} onClick={() => chooseType({ method: "open" })} icon={<Megaphone className="w-4 h-4" />}
                    title="Open challenge" text="First one in your department to accept takes it." />
                </div>
              </Field>
              <Field label="Format">
                <div className="grid grid-cols-2 gap-2">
                  <Choice active={t.format === "head_to_head"} onClick={() => chooseType({ format: "head_to_head" })} icon={<Swords className="w-4 h-4" />}
                    title="Head to head" text="Both sides compete on the same metric." />
                  <Choice active={isSelf} onClick={() => chooseType({ format: "self_declaration" })} icon={<Target className="w-4 h-4" />}
                    title="Self-declaration" text="You declare a target. They bet you won't hit it." />
                </div>
              </Field>
              {t.method === "named" && !isSelf && (
                <Field label="Size">
                  <div className="grid grid-cols-2 gap-2">
                    <Choice active={!t.team} onClick={() => chooseType({ team: false })} icon={<UserRound className="w-4 h-4" />} title="1 on 1" text="Against someone more senior counts as vs Upline." />
                    <Choice active={t.team} onClick={() => chooseType({ team: true })} icon={<Users className="w-4 h-4" />} title="Team" text="2 to 5 a side, each side has a captain." />
                  </div>
                </Field>
              )}
            </>
          )}

          {step === 1 && (
            t.method === "open" ? (
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                Anyone in {myDept ?? "your department"} can take this on. If nobody accepts within 7 days it expires.
              </p>
            ) : (
              <>
                {t.team && (
                  <Field label={`Your team (you're the captain), ${sideA.length + 1} of ${MAX_TEAM}`}>
                    <div className="space-y-2">
                      {t.participants.map((p, i) => (p.side === "A" ? personPicker(i, "Teammate") : null))}
                      {sideA.length + 1 < MAX_TEAM && (
                        <Button type="button" variant="outline" size="sm" onClick={() => addPerson("A")}><Plus className="w-3.5 h-3.5 mr-1" /> Add teammate</Button>
                      )}
                    </div>
                  </Field>
                )}
                <Field label={t.team ? `Other team, ${sideB.length} of ${MAX_TEAM} (tap the crown to pick their captain)` : "Opponent"}>
                  <div className="space-y-2">
                    {t.participants.map((p, i) => (p.side === "B" ? personPicker(i, t.team ? "Opponent" : "Choose your opponent") : null))}
                    {t.team && sideB.length < MAX_TEAM && (
                      <Button type="button" variant="outline" size="sm" onClick={() => addPerson("B")}><Plus className="w-3.5 h-3.5 mr-1" /> Add opponent</Button>
                    )}
                  </div>
                </Field>
                <p className="text-xs text-muted-foreground">Only people in {myDept ?? "your department"} are listed.</p>
              </>
            )
          )}

          {step === 2 && (
            <>
              <Field label="Title"><input className={input} maxLength={120} value={t.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Most closed deals in October" /></Field>
              <Field label="What's measured"><input className={input} value={t.metric} onChange={(e) => set("metric", e.target.value)} placeholder="e.g. Closed deals" /></Field>
              <Field label="Exactly how it's counted">
                <textarea className={cn(input, "h-auto min-h-[64px] py-2")} value={t.metric_definition} onChange={(e) => set("metric_definition", e.target.value)}
                  placeholder="e.g. Deals marked Won in the CRM with the payment received" />
              </Field>
              <Field label="Who wins">
                <div className="grid grid-cols-2 gap-2">
                  <Choice active={t.direction === "higher"} onClick={() => set("direction", "higher")} title="Higher number wins" />
                  <Choice active={t.direction === "lower"} onClick={() => set("direction", "lower")} title="Lower number wins" text="e.g. response time, errors" />
                </div>
              </Field>
              {!isSelf && (
                <Field label="Scoring">
                  <div className="grid gap-2">
                    {(Object.keys(PK_SCORING_LABEL) as PkScoring[]).map((s) => (
                      <Choice key={s} active={t.scoring === s} onClick={() => set("scoring", s)} title={PK_SCORING_LABEL[s]} text={PK_SCORING_HINT[s]} />
                    ))}
                  </div>
                </Field>
              )}
              <Field label="What counts as proof"><input className={input} value={t.proof_method} onChange={(e) => set("proof_method", e.target.value)} placeholder="e.g. CRM screenshot showing the date range" /></Field>
              <Field label="How often scores are updated">
                <SearchableSelect value={t.update_frequency} onValueChange={(v) => set("update_frequency", v)} searchable={false} aria-label="Update frequency"
                  options={PK_UPDATE_FREQUENCIES.map((f) => ({ value: f.value, label: f.value, description: f.hint }))} />
                <p className="text-[11px] text-muted-foreground mt-1">Miss one and you get a reminder, miss 2 in a row and it's a warning, 3 is a violation.</p>
              </Field>
              <Field label="Description (optional)">
                <textarea className={cn(input, "h-auto min-h-[56px] py-2")} value={t.description} onChange={(e) => set("description", e.target.value)} placeholder="Anything else people should know" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              {!needsBaseline && !needsTarget ? (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">No baselines or targets needed for {PK_SCORING_LABEL[t.scoring ?? "absolute"].toLowerCase()} scoring.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {isSelf ? "Your current level, and the target you're declaring you'll reach." : needsBaseline ? "Everyone's starting number. Gains are measured from here." : "Each person's target. Winner reaches the highest % of theirs."}
                    {t.method === "open" && !isSelf && " Whoever accepts fills in their own."}
                  </p>
                  {numberRow("You", t.creator, (patch) => set("creator", { ...t.creator, ...patch }))}
                  {!isSelf && t.participants.map((p, i) => numberRow(`@${nameOf(p.user_id)}`, p, (patch) => setPerson(i, patch)))}
                </div>
              )}
              {!isSelf && (
                <Field label="Winning target (optional)">
                  <input type="number" className={input} value={t.winning_target} onChange={(e) => set("winning_target", e.target.value)} placeholder="Score someone must reach to win" />
                </Field>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts"><DatePicker value={t.starts_at || null} onChange={(v) => set("starts_at", v)} minDate={today} /></Field>
                <Field label="Ends"><DatePicker value={t.ends_at || null} onChange={(v) => set("ends_at", v)} minDate={t.starts_at > tomorrow ? t.starts_at : tomorrow} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Winner gets"><input className={input} value={t.reward} onChange={(e) => set("reward", e.target.value)} placeholder="e.g. Loser buys lunch" /></Field>
                <Field label="Loser does"><input className={input} value={t.punishment} onChange={(e) => set("punishment", e.target.value)} placeholder="e.g. Presents the playbook" /></Field>
              </div>
              <Field label="PK Money, USD (optional)">
                <input type="number" min={0} step="0.01" className={input} value={t.pk_money} onChange={(e) => set("pk_money", e.target.value)} placeholder="0" />
                <p className="text-[11px] text-muted-foreground mt-1">Tracked only, nothing is paid through the app. Monthly limit: USD 50, ATL/TL 100, above TL 200.</p>
              </Field>
              <Field label="Tiebreaker (optional)"><input className={input} value={t.tiebreaker} onChange={(e) => set("tiebreaker", e.target.value)} placeholder="e.g. Whoever got there first" /></Field>
            </>
          )}

          {step === 5 && (
            <>
              <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <Summary k="Title" v={t.title} />
                <Summary k="Type" v={[t.method === "open" ? "Open" : "Named", isSelf ? "self-declaration" : "head to head", t.team && "team"].filter(Boolean).join(", ")} />
                {t.method === "named" && <Summary k="Against" v={sideB.map((p) => `@${nameOf(p.user_id)}${t.team && p.is_captain ? " (captain)" : ""}`).join(", ")} />}
                {t.team && <Summary k="With you" v={sideA.map((p) => `@${nameOf(p.user_id)}`).join(", ")} />}
                <Summary k="Metric" v={`${t.metric} (${t.direction === "higher" ? "higher" : "lower"} wins)`} />
                {!isSelf && t.scoring && <Summary k="Scoring" v={PK_SCORING_LABEL[t.scoring]} />}
                {isSelf && <Summary k="Declared" v={`${t.creator.baseline} → ${t.creator.target}`} />}
                <Summary k="Dates" v={`${t.starts_at} to ${t.ends_at}`} />
                {t.reward && <Summary k="Winner gets" v={t.reward} />}
                {t.punishment && <Summary k="Loser does" v={t.punishment} />}
                {t.pk_money && Number(t.pk_money) > 0 && <Summary k="PK Money" v={`USD ${t.pk_money}`} />}
                <Summary k="Proof" v={t.proof_method} />
              </dl>
              <label className="flex items-start gap-2 text-sm bg-muted/40 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={t.compliance_agreed} onChange={(e) => set("compliance_agreed", e.target.checked)} />
                <span>I'll play fair: real numbers only, proof with every update, no pressuring anyone into joining. Breaking this can void the PK.</span>
              </label>
            </>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={step === firstStep || busy} onClick={() => { setError(null); setStep((s) => Math.max(s - 1, firstStep)); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button type="button" variant="secondary" disabled={busy} onClick={submit}>
              <Check className="w-4 h-4 mr-1" /> {busy ? "Sending..." : isCounter ? "Send counter-proposal" : t.method === "open" ? "Post challenge" : "Send challenge"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Choice({ active, onClick, title, text, icon }: { active: boolean; onClick: () => void; title: string; text?: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("text-left rounded-lg border p-3 transition-colors", active ? "border-secondary bg-secondary/10" : "border-border hover:bg-muted/50")}>
      <div className="flex items-center gap-1.5 text-sm font-medium">{icon}{title}</div>
      {text && <div className="text-[11px] text-muted-foreground mt-0.5">{text}</div>}
    </button>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium break-words">{v || "–"}</dd>
    </>
  );
}
