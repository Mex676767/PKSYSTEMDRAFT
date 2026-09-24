import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { PageTransition, staggerContainer } from "@/components/animations";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Swords, Plus, Check, X, Clock, Trophy, Gift, Skull, Trash2, MessageCircle, ChevronDown, ChevronUp, Megaphone, ShieldCheck } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useChallengesList,
  useRespondChallenge,
  useCancelChallenge,
  useUpdateChallengeScore,
  useCompleteChallenge,
  useDeleteChallenge,
  type Challenge,
} from "@/hooks/use-challenges";
import { usePkApprovals, usePkList } from "@/hooks/use-pk";
import { PkCard, pkNextStep } from "@/components/pk/pk-card";
import { PkWizard } from "@/components/pk/pk-wizard";
import { PkLeaderboard } from "@/components/pk/pk-leaderboard";
import { PkLibrary } from "@/components/pk/pk-library";
import { PkMoneyCard } from "@/components/pk/pk-money-card";
import { PK_CLOSED, PK_LIVE, PK_SETUP, type Pk } from "@/lib/pk";
import { useComments } from "@/hooks/use-social";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { ProgressPhotos } from "@/components/progress-photos";
import { challengeDirection, CHALLENGE_DIRECTION_LABEL } from "@/lib/roles";
import { getErrorMessage, cn } from "@/lib/utils";
import { useOrgStructure } from "@/hooks/use-org-structure";

type Tab = "arena" | "mine" | "approve" | "leaderboard" | "playbooks" | "old";

export default function Challenges() {
  const { session } = useAuth();
  const mine = session?.user.id;
  const { data: pks = [], isLoading } = usePkList();
  const { data: approvals = new Set<string>() } = usePkApprovals();
  const { data: legacy = [] } = useChallengesList();
  const [, navigate] = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("arena");
  const [showClosed, setShowClosed] = useState(false);

  const involved = (pk: Pk) => pk.participants.some((p) => p.user_id === mine);
  const myPks = pks.filter(involved);
  const toApprove = pks.filter((pk) => approvals.has(pk.id));
  const openForMe = pks.filter((pk) => pk.status === "awaiting_opponent" && pk.method === "open" && !involved(pk));
  const live = pks.filter((pk) => PK_LIVE.includes(pk.status));
  const recentlySettled = pks
    .filter((pk) => pk.status === "settled")
    .sort((x, y) => (y.settled_at ?? "").localeCompare(x.settled_at ?? ""))
    .slice(0, 5);
  const needsMe = myPks.filter((pk) => pkNextStep(pk, mine, false));

  useEffect(() => {
    if (!isLoading && (needsMe.length > 0 || toApprove.length > 0) && tab === "arena") setTab(needsMe.length > 0 ? "mine" : "approve");
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-secondary/20" /></div>;
  }

  const cards = (list: Pk[]) => list.map((pk) => <PkCard key={pk.id} pk={pk} viewerId={mine} canApprove={approvals.has(pk.id)} />);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "arena", label: "Arena" },
    { id: "mine", label: "My PKs", count: needsMe.length },
    { id: "approve", label: "To approve", count: toApprove.length },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "playbooks", label: "Playbooks" },
    { id: "old", label: "Old challenges" },
  ];

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Battle Arena</h1>
          <p className="text-muted-foreground mt-1">Challenge someone in your department. Agree the terms, get it approved, prove every score.</p>
        </div>
        <Button className="shrink-0 hover-elevate" disabled={!session} onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Start a PK
        </Button>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.filter((t) => t.id !== "approve" || toApprove.length > 0 || tab === "approve").map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t.id ? "border-secondary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {!!t.count && <span className="ml-1.5 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "arena" && (
        <>
          {openForMe.length > 0 && <Section title="Open challenges" icon={Megaphone}>{cards(openForMe)}</Section>}
          <Section title="Live PKs" icon={Swords}>
            {live.length === 0 ? <EmptyState text="No PKs running right now. Start one." /> : cards(live)}
          </Section>
          {recentlySettled.length > 0 && <Section title="Recently settled" icon={Trophy}>{cards(recentlySettled)}</Section>}
        </>
      )}

      {tab === "mine" && (
        <>
          <PkMoneyCard />
          <Section title="Being set up" icon={Clock}>
            {myPks.filter((pk) => PK_SETUP.includes(pk.status)).length === 0
              ? <EmptyState text="Nothing waiting. Start a PK or take an open one in the Arena." />
              : cards(myPks.filter((pk) => PK_SETUP.includes(pk.status)))}
          </Section>
          {myPks.some((pk) => PK_LIVE.includes(pk.status)) && (
            <Section title="Live" icon={Swords}>{cards(myPks.filter((pk) => PK_LIVE.includes(pk.status)))}</Section>
          )}
          {myPks.some((pk) => PK_CLOSED.includes(pk.status)) && (
            <div className="space-y-3">
              <button onClick={() => setShowClosed((s) => !s)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                {showClosed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Finished ({myPks.filter((pk) => PK_CLOSED.includes(pk.status)).length})
              </button>
              {showClosed && <div className="grid gap-3">{cards(myPks.filter((pk) => PK_CLOSED.includes(pk.status)))}</div>}
            </div>
          )}
        </>
      )}

      {tab === "approve" && (
        <Section title="Waiting for you to approve or confirm" icon={ShieldCheck}>
          {toApprove.length === 0 ? <EmptyState text="Nothing to approve." /> : cards(toApprove)}
        </Section>
      )}

      {tab === "leaderboard" && <PkLeaderboard />}
      {tab === "playbooks" && <PkLibrary />}

      {tab === "old" && (
        <Section title="Challenges from before the PK system" icon={Trophy}>
          {legacy.length === 0 ? <EmptyState text="No old challenges." /> : legacy.map((c) => <ChallengeCard key={c.id} challenge={c} viewerId={mine} />)}
        </Section>
      )}

      <PkWizard open={wizardOpen} onOpenChange={setWizardOpen} onDone={(id) => id && navigate(`/challenges/${id}`)} />
    </PageTransition>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Swords; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-secondary" /> {title}
      </h2>
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3">
        {children}
      </motion.div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-8 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground text-sm">
      {text}
    </div>
  );
}

function PersonBadge({
  id,
  username,
  role,
  photoUrl,
  border,
  accessory,
}: {
  id: string;
  username: string | null | undefined;
  role: string | null | undefined;
  photoUrl?: string | null;
  border?: string | null;
  accessory?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <UserAvatar
        user={{ name: username ?? "unknown", initials: initialsForUsername(username ?? "?"), color: colorForId(id) }}
        photoUrl={photoUrl}
        border={border}
        accessory={accessory}
        className="w-8 h-8 text-[10px] shrink-0"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">@{username ?? "unknown"}</div>
        {role && <div className="text-[10px] text-muted-foreground">{role}</div>}
      </div>
    </div>
  );
}

function ChallengeCard({ challenge: c, viewerId }: { challenge: Challenge; viewerId: string | undefined }) {
  const { roles } = useOrgStructure();
  const { isAdmin } = useAuth();
  const respond = useRespondChallenge();
  const cancel = useCancelChallenge();
  const updateScore = useUpdateChallengeScore();
  const complete = useCompleteChallenge();
  const deleteChallenge = useDeleteChallenge();
  const [error, setError] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("challenge", c.id);

  const isCreator = c.creator_id === viewerId;
  const isOpponent = c.opponent_id === viewerId;
  const isParticipant = isCreator || isOpponent;
  const myScore = isCreator ? c.score_creator : c.score_opponent;
  const direction = challengeDirection(c.creator?.role, c.opponent?.role, roles);
  const canDelete = (isCreator || isAdmin) && (c.status === "declined" || c.status === "completed");

  const run = (fn: () => Promise<void> | void) => {
    setError(null);
    try {
      const r = fn();
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch((err) => setError(getErrorMessage(err)));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Card className={cn(
      "shadow-sm",
      c.status === "completed" && "border-emerald-500/30",
      c.status === "declined" && "opacity-60 border-dashed"
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm">{c.topic}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[9px]">{CHALLENGE_DIRECTION_LABEL[direction]}</Badge>
            {c.status === "pending" && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Pending</Badge>}
            {c.status === "active" && <Badge className="text-[10px] bg-primary hover:bg-primary">Active</Badge>}
            {c.status === "completed" && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Completed</Badge>}
            {c.status === "declined" && <Badge variant="outline" className="text-[10px]">Declined</Badge>}
            {canDelete && (
              <button
                onClick={() => window.confirm("Delete this challenge?") && run(() => deleteChallenge.mutateAsync(c.id))}
                disabled={deleteChallenge.isPending}
                title="Delete challenge"
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <PersonBadge id={c.creator_id} username={c.creator?.username} role={c.creator?.role} photoUrl={c.creator?.avatar_url} border={c.creator?.active_border} accessory={c.creator?.active_accessory} />
          <div className="flex items-center gap-2 shrink-0 text-sm font-bold tabular-nums">
            <span className={cn(c.winner_id === c.creator_id && "text-emerald-500")}>{c.score_creator}</span>
            <span className="text-muted-foreground text-xs font-normal">vs</span>
            <span className={cn(c.winner_id === c.opponent_id && "text-emerald-500")}>{c.score_opponent}</span>
          </div>
          <PersonBadge id={c.opponent_id} username={c.opponent?.username} role={c.opponent?.role} photoUrl={c.opponent?.avatar_url} border={c.opponent?.active_border} accessory={c.opponent?.active_accessory} />
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          {c.description ? (
            <span className="line-clamp-1">{c.description}</span>
          ) : (
            <span className="italic opacity-60">No description</span>
          )}
          <span className="flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" /> {format(new Date(c.ends_at), "MMM d, yyyy")}</span>
        </div>

        {(c.reward || c.punishment) && (
          <div className="flex flex-wrap gap-2">
            {c.reward && (
              <span className="flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-600 rounded-full px-2 py-1">
                <Gift className="w-3 h-3" /> {c.reward}
              </span>
            )}
            {c.punishment && (
              <span className="flex items-center gap-1 text-[11px] bg-destructive/10 text-destructive rounded-full px-2 py-1">
                <Skull className="w-3 h-3" /> {c.punishment}
              </span>
            )}
          </div>
        )}

        {c.status === "completed" && (
          <p className="text-xs font-medium text-center pt-1 border-t border-border/50">
            {c.winner_id
              ? `🏆 @${c.winner_id === c.creator_id ? c.creator?.username : c.opponent?.username} wins!`
              : "It's a draw."}
          </p>
        )}

        {c.status === "pending" && isOpponent && (
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button size="sm" className="flex-1" disabled={respond.isPending} onClick={() => run(() => respond.mutateAsync({ challengeId: c.id, accept: true }))}>
              <Check className="w-3.5 h-3.5 mr-1.5" /> Accept
            </Button>
            <Button size="sm" variant="outline" className="flex-1" disabled={respond.isPending} onClick={() => run(() => respond.mutateAsync({ challengeId: c.id, accept: false }))}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Decline
            </Button>
          </div>
        )}
        {c.status === "pending" && isCreator && (
          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Waiting for @{c.opponent?.username} to respond...</span>
            <button
              onClick={() => window.confirm("Cancel this challenge?") && run(() => cancel.mutateAsync(c.id))}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {c.status === "active" && isParticipant && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <input
              type="number"
              min={0}
              placeholder={`Your score (${myScore})`}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={scoreInput === "" || updateScore.isPending}
              onClick={() => run(() => updateScore.mutateAsync({ challengeId: c.id, score: Number(scoreInput) }).then(() => setScoreInput("")))}
            >
              Update My Score
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs ml-auto"
              disabled={complete.isPending}
              onClick={() => window.confirm("Mark this challenge complete? The higher score wins.") && run(() => complete.mutateAsync(c.id))}
            >
              Mark Complete
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <ProgressPhotos targetType="challenge" targetId={c.id} canUpload={isParticipant} />

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border/50 -mx-4 px-4 pt-3">
          <ReactionBar targetType="challenge" targetId={c.id} />
          <button
            onClick={() => setShowComments((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comment"}
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showComments && (
          <div className="pt-1">
            <CommentSection targetType="challenge" targetId={c.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
