import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Check, Crown, FileClock, History, ImageIcon, MessageCircle, PencilLine, ShieldCheck, ShieldX, Swords, Trash2, X,
} from "lucide-react";
import { PageTransition } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePickerButton } from "@/components/image-picker-button";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { PkAvatar, PkSideBlock, pkNextStep } from "@/components/pk/pk-card";
import { PkWizard } from "@/components/pk/pk-wizard";
import { useAuth } from "@/hooks/use-auth";
import {
  getPkProofUrl, useAcceptOpenPk, useCancelPk, useDeletePk, usePk, usePkApprovals, usePkSettings, useRespondPk,
  useReviewPk, useUpdatePkScore, type PkTermsVersion,
} from "@/hooks/use-pk";
import {
  PK_LIVE, PK_SCORING_LABEL, PK_SETUP, PK_STATUS_LABEL, PK_TYPE_LABEL, formatPkNumber, pkScoreSuffix, pkSide, pkStatusTone,
  termsFromPk, type Pk,
} from "@/lib/pk";
import { cn, getErrorMessage } from "@/lib/utils";

export default function PkDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = usePk(id);
  const { session } = useAuth();

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-secondary/20" /></div>;
  }
  if (error || !data?.pk) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <p className="text-muted-foreground">{error ? getErrorMessage(error) : "This PK doesn't exist or was removed."}</p>
        <Link href="/challenges"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1" /> Back to the arena</Button></Link>
      </div>
    );
  }
  return <PkDetailBody data={data} viewerId={session?.user.id} />;
}

type Detail = NonNullable<ReturnType<typeof usePk>["data"]>;

function PkDetailBody({ data, viewerId }: { data: Detail; viewerId: string | undefined }) {
  const pk = data.pk!;
  const { isAdmin } = useAuth();
  const { data: approvals = new Set<string>() } = usePkApprovals();
  const [tab, setTab] = useState<"timeline" | "scores" | "terms" | "comments">(PK_LIVE.includes(pk.status) ? "scores" : "timeline");
  const a = pkSide(pk, "A");
  const b = pkSide(pk, "B");
  const isSelf = pk.format === "self_declaration";
  const live = PK_LIVE.includes(pk.status);
  const suffix = pkScoreSuffix(pk);
  const scoreOf = (side: "A" | "B") => data.sides.find((s) => s.side === side)?.score ?? null;
  const canApprove = approvals.has(pk.id);
  const next = pkNextStep(pk, viewerId, canApprove);

  return (
    <PageTransition className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <Link href="/challenges" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Arena
      </Link>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium", pkStatusTone(pk.status))}>{PK_STATUS_LABEL[pk.status]}</span>
          {pk.pk_type && <span className="text-xs border rounded-full px-2 py-0.5">{PK_TYPE_LABEL[pk.pk_type]}</span>}
          {isSelf && <span className="text-xs border rounded-full px-2 py-0.5">Self-declaration</span>}
          {pk.method === "open" && <span className="text-xs border rounded-full px-2 py-0.5">Open challenge</span>}
          <span className="text-xs text-muted-foreground">{pk.department}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{pk.topic}</h1>
        {pk.description && <p className="text-muted-foreground text-sm">{pk.description}</p>}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <PkSideBlock people={a} align="left" />
            <div className="text-center shrink-0">
              {live ? (
                <div className="text-2xl font-black tabular-nums">
                  {formatPkNumber(scoreOf("A"))}{suffix}
                  {!isSelf && <><span className="text-muted-foreground text-sm font-normal mx-2">vs</span>{formatPkNumber(scoreOf("B"))}{suffix}</>}
                </div>
              ) : <span className="text-lg font-black tracking-widest text-secondary">VS</span>}
              {live && <div className="text-[10px] text-muted-foreground">{isSelf ? "of declared target" : pk.scoring ? PK_SCORING_LABEL[pk.scoring] : ""}</div>}
            </div>
            <PkSideBlock people={b} align="right" placeholder={isSelf ? "Who'll bet against?" : "Open slot"} />
          </div>
        </CardContent>
      </Card>

      {next && <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{next}</p>}
      <PkActions pk={pk} viewerId={viewerId} canApprove={canApprove} isAdmin={isAdmin} />

      <PkTerms pk={pk} />

      <div role="tablist" className="flex gap-1 border-b border-border overflow-x-auto">
        {([["timeline", "Timeline", History], ["scores", `Score updates (${data.scores.length})`, ImageIcon], ["terms", "Terms history", FileClock], ["comments", "Comments", MessageCircle]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5",
              tab === k ? "border-secondary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <ol className="space-y-3">
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p>{e.message}</p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(e.created_at), "MMM d, h:mm a")}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {tab === "scores" && (
        data.scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No score updates yet. Every update needs proof.</p>
        ) : (
          <div className="grid gap-3">
            {data.scores.map((s) => {
              const person = pk.participants.find((p) => p.user_id === s.user_id);
              return (
                <Card key={s.id}>
                  <CardContent className="p-3 flex gap-3">
                    {person && <PkAvatar p={person} className="w-8 h-8 text-[10px]" />}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">@{s.profile?.username ?? "unknown"} <span className="font-bold tabular-nums">{formatPkNumber(s.value)}</span></span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                      </div>
                      {s.comment && <p className="text-xs text-muted-foreground">{s.comment}</p>}
                      <a href={getPkProofUrl(s.proof_path)} target="_blank" rel="noreferrer" className="block">
                        <img src={getPkProofUrl(s.proof_path)} alt="Proof" loading="lazy" className="max-h-40 rounded-md border object-contain bg-muted/40" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === "terms" && <TermsHistory versions={data.terms} />}

      {tab === "comments" && (
        <div className="space-y-3">
          <ReactionBar targetType="challenge" targetId={pk.id} />
          <CommentSection targetType="challenge" targetId={pk.id} />
        </div>
      )}
    </PageTransition>
  );
}

function PkActions({ pk, viewerId, canApprove, isAdmin }: { pk: Pk; viewerId: string | undefined; canApprove: boolean; isAdmin: boolean }) {
  const [, navigate] = useLocation();
  const respond = useRespondPk();
  const acceptOpen = useAcceptOpenPk();
  const cancel = useCancelPk();
  const review = useReviewPk();
  const remove = useDeletePk();
  const { data: settings } = usePkSettings();
  const [error, setError] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mine, setMine] = useState({ baseline: "", target: "" });

  const me = pk.participants.find((p) => p.user_id === viewerId);
  const isCreator = pk.creator_id === viewerId;
  const negotiating = pk.status === "awaiting_opponent" || pk.status === "countered";
  const roundsLeft = (settings?.max_counter_rounds ?? 2) - pk.counter_round;
  const openForMe = pk.status === "awaiting_opponent" && pk.method === "open" && !me && !!viewerId;
  const needsBaseline = pk.scoring === "improvement";
  const needsTarget = pk.scoring === "completion";
  const canScore = pk.status === "active" && !!me && (pk.format !== "self_declaration" || me.side === "A");

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(getErrorMessage(err)); }
  };
  const input = "flex h-9 rounded-md border border-input bg-background px-3 text-sm";

  const blocks: ReactNode[] = [];

  if (negotiating && me && !me.accepted_at) {
    blocks.push(
      <div key="respond" className="flex flex-wrap gap-2">
        <Button size="sm" disabled={respond.isPending} onClick={() => run(() => respond.mutateAsync({ id: pk.id, response: "accept" }))}>
          <Check className="w-4 h-4 mr-1" /> Accept these terms
        </Button>
        {me.is_captain && roundsLeft > 0 && (
          <Button size="sm" variant="outline" onClick={() => setCounterOpen(true)}>
            <PencilLine className="w-4 h-4 mr-1" /> Counter ({roundsLeft} left)
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" disabled={respond.isPending}
          onClick={() => window.confirm("Decline this PK? It ends for everyone.") && run(() => respond.mutateAsync({ id: pk.id, response: "decline" }))}>
          <X className="w-4 h-4 mr-1" /> Decline
        </Button>
      </div>,
    );
  }

  if (negotiating && me?.accepted_at && pk.method === "named") {
    const waiting = pk.participants.filter((p) => !p.accepted_at).map((p) => `@${p.profile?.username ?? "someone"}`);
    if (waiting.length) blocks.push(<p key="waiting" className="text-sm text-muted-foreground">Waiting for {waiting.join(", ")} to respond.</p>);
  }

  if (openForMe) {
    blocks.push(
      <div key="open" className="flex flex-wrap items-center gap-2">
        {needsBaseline && <input type="number" className={cn(input, "w-32")} placeholder="Your baseline" value={mine.baseline} onChange={(e) => setMine({ ...mine, baseline: e.target.value })} />}
        {needsTarget && <input type="number" className={cn(input, "w-32")} placeholder="Your target" value={mine.target} onChange={(e) => setMine({ ...mine, target: e.target.value })} />}
        <Button size="sm" disabled={acceptOpen.isPending}
          onClick={() => window.confirm("Take this challenge on these terms?") && run(() => acceptOpen.mutateAsync({ id: pk.id, ...mine }))}>
          <Swords className="w-4 h-4 mr-1" /> {pk.format === "self_declaration" ? "Bet against it" : "Accept challenge"}
        </Button>
      </div>,
    );
  }

  if (pk.status === "awaiting_approval" && canApprove) {
    blocks.push(
      <div key="review" className="space-y-2">
        <textarea className={cn(input, "w-full h-auto min-h-[56px] py-2")} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (required if you reject: say what to fix)" />
        <div className="flex gap-2">
          <Button size="sm" disabled={review.isPending} onClick={() => run(() => review.mutateAsync({ id: pk.id, approve: true, note }))}>
            <ShieldCheck className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={review.isPending}
            onClick={() => run(() => review.mutateAsync({ id: pk.id, approve: false, note }))}>
            <ShieldX className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      </div>,
    );
  }

  if (canScore) blocks.push(<ScoreForm key="score" pk={pk} onError={setError} />);

  const canCancel = (isCreator || isAdmin) && PK_SETUP.includes(pk.status);
  const canRemove = isAdmin;
  if (canCancel || canRemove) {
    blocks.push(
      <div key="manage" className="flex items-center gap-3 text-xs">
        {canCancel && (
          <button className="text-muted-foreground hover:text-destructive" disabled={cancel.isPending}
            onClick={() => window.confirm("Cancel this PK?") && run(() => cancel.mutateAsync(pk.id))}>Cancel PK</button>
        )}
        {canRemove && (
          <Button size="sm" variant="destructive" className="ml-auto h-8" disabled={remove.isPending}
            onClick={() => window.confirm("Delete this PK for good? Its scores, proof and history go with it.") &&
              run(() => remove.mutateAsync(pk.id).then(() => navigate("/challenges")))}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> {remove.isPending ? "Deleting..." : "Delete PK"}
          </Button>
        )}
      </div>,
    );
  }

  if (blocks.length === 0 && !error) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {blocks}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      {counterOpen && <PkWizard open={counterOpen} onOpenChange={setCounterOpen} counterOf={pk} initial={termsFromPk(pk)} />}
    </Card>
  );
}

function ScoreForm({ pk, onError }: { pk: Pk; onError: (e: string | null) => void }) {
  const update = useUpdatePkScore();
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const input = "flex h-9 rounded-md border border-input bg-background px-3 text-sm";

  const submit = async () => {
    onError(null);
    if (value === "") return onError("Enter your current number.");
    if (!file) return onError("Attach proof. Every update needs it.");
    try {
      await update.mutateAsync({ id: pk.id, value: Number(value), file, comment });
      setValue(""); setComment(""); setFile(null);
    } catch (err) {
      onError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Update your score</p>
      <p className="text-xs text-muted-foreground">Your running total for {pk.metric}, not just today's. Proof: {pk.proof_method}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" inputMode="decimal" min={0} className={cn(input, "w-32")} placeholder="Current total" value={value} onChange={(e) => setValue(e.target.value)} />
        <input className={cn(input, "flex-1 min-w-[10rem]")} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Proof" className="max-h-32 rounded-md border" />
          <button type="button" onClick={() => setFile(null)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <ImagePickerButton onImage={setFile} label="Proof screenshot" />
      )}
      <Button size="sm" disabled={update.isPending} onClick={submit}>{update.isPending ? "Uploading..." : "Post update"}</Button>
    </div>
  );
}

function PkTerms({ pk }: { pk: Pk }) {
  const rows: [string, ReactNode][] = [
    ["Metric", `${pk.metric} (${pk.direction === "lower" ? "lower" : "higher"} wins)`],
    ["Counted as", pk.metric_definition],
    ...(pk.scoring && pk.format !== "self_declaration" ? [["Scoring", PK_SCORING_LABEL[pk.scoring]] as [string, ReactNode]] : []),
    ...(pk.winning_target !== null ? [[pk.format === "self_declaration" ? "Declared target" : "Winning target", formatPkNumber(pk.winning_target)] as [string, ReactNode]] : []),
    ["Dates", `${format(new Date(pk.starts_at), "MMM d, yyyy")} to ${format(new Date(pk.ends_at), "MMM d, yyyy")}`],
    ["Updates", pk.update_frequency],
    ["Proof", pk.proof_method],
    ...(pk.reward ? [["Winner gets", pk.reward] as [string, ReactNode]] : []),
    ...(pk.punishment ? [["Loser does", pk.punishment] as [string, ReactNode]] : []),
    ...(pk.pk_money > 0 ? [["PK Money", `USD ${formatPkNumber(pk.pk_money)} (tracked only)`] as [string, ReactNode]] : []),
    ...(pk.tiebreaker ? [["Tiebreaker", pk.tiebreaker] as [string, ReactNode]] : []),
    ...(pk.review_note ? [["Approver's note", pk.review_note] as [string, ReactNode]] : []),
  ];
  const showNumbers = pk.participants.some((p) => p.baseline !== null || p.target !== null || p.current_value !== null);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Terms</h2>
          <span className="text-[11px] text-muted-foreground">Version {pk.terms_version}{pk.counter_round > 0 && `, ${pk.counter_round} counter${pk.counter_round === 1 ? "" : "s"}`}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v || "–"}</dd>
            </div>
          ))}
        </dl>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground text-left">
                <th className="font-normal py-1">Who</th>
                {showNumbers && <><th className="font-normal">Baseline</th><th className="font-normal">Target</th><th className="font-normal">Now</th></>}
                <th className="font-normal text-right">Agreed</th>
              </tr>
            </thead>
            <tbody>
              {pk.participants.slice().sort((x, y) => x.side.localeCompare(y.side) || Number(y.is_captain) - Number(x.is_captain)).map((p) => (
                <tr key={p.user_id} className="border-t border-border/50">
                  <td className="py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] font-bold w-4", p.side === "A" ? "text-secondary" : "text-primary")}>{p.side}</span>
                      @{p.profile?.username ?? "unknown"}
                      {p.is_captain && pk.pk_type === "team" && <Crown className="w-3 h-3 text-amber-500" />}
                    </span>
                  </td>
                  {showNumbers && <><td className="tabular-nums">{formatPkNumber(p.baseline)}</td><td className="tabular-nums">{formatPkNumber(p.target)}</td><td className="tabular-nums">{formatPkNumber(p.current_value)}</td></>}
                  <td className="text-right">{p.accepted_at ? <Check className="w-4 h-4 text-emerald-500 inline" /> : <span className="text-[11px] text-muted-foreground">not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const TERM_LABELS: Record<string, string> = {
  title: "Title", description: "Description", metric: "Metric", metric_definition: "Counted as", direction: "Direction",
  scoring: "Scoring", winning_target: "Winning target", starts_at: "Starts", ends_at: "Ends", update_frequency: "Updates",
  reward: "Winner gets", punishment: "Loser does", pk_money: "PK Money", proof_method: "Proof", tiebreaker: "Tiebreaker",
};
const ACTION_LABELS: Record<string, string> = {
  proposed: "Proposed", countered: "Counter-proposal", agreed: "Agreed by everyone", approved: "Approved", accepted_open: "Accepted (open)",
};

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return format(new Date(v), "MMM d, yyyy");
  return String(v);
}

function TermsHistory({ versions }: { versions: PkTermsVersion[] }) {
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">No terms recorded.</p>;
  // Oldest first to work out what changed, newest shown first.
  const ordered = versions.slice().reverse();
  return (
    <ol className="space-y-3">
      {ordered.map((v, i) => {
        const prev = ordered[i - 1]?.terms;
        const changed = prev ? Object.keys(TERM_LABELS).filter((k) => show(prev[k]) !== show(v.terms[k])) : [];
        const people = (v.terms.participants ?? []).map((p) => `@${p.username}: ${show(p.baseline)} → ${show(p.target)}`);
        const prevPeople = (prev?.participants ?? []).map((p) => `@${p.username}: ${show(p.baseline)} → ${show(p.target)}`);
        const peopleChanged = prev && people.join() !== prevPeople.join();
        return (
          <li key={v.id} className="border rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">v{v.version} · {ACTION_LABELS[v.action] ?? v.action}{v.actor?.username && ` by @${v.actor.username}`}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(v.created_at), "MMM d, h:mm a")}</span>
            </div>
            {prev && changed.length === 0 && !peopleChanged && <p className="text-xs text-muted-foreground">No changes to the terms.</p>}
            {changed.map((k) => (
              <p key={k} className="text-xs">
                <span className="text-muted-foreground">{TERM_LABELS[k]}:</span> <s className="text-muted-foreground">{show(prev![k])}</s> → {show(v.terms[k])}
              </p>
            ))}
            {peopleChanged && <p className="text-xs"><span className="text-muted-foreground">Numbers:</span> {people.join(", ")}</p>}
          </li>
        );
      }).reverse()}
    </ol>
  );
}
