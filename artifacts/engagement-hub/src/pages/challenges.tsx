import { useMemo, useState } from "react";
import { format } from "date-fns";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { motion } from "framer-motion";
import { Swords, Plus, Check, X, Clock, Trophy, Gift, Skull, Trash2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useChallengesList,
  useCreateChallenge,
  useRespondChallenge,
  useCancelChallenge,
  useUpdateChallengeScore,
  useCompleteChallenge,
  useDeleteChallenge,
  type Challenge,
} from "@/hooks/use-challenges";
import { useDirectory } from "@/hooks/use-mentors";
import { useComments } from "@/hooks/use-social";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { challengeDirection, CHALLENGE_DIRECTION_LABEL } from "@/lib/roles";
import { getErrorMessage, cn } from "@/lib/utils";

export default function Challenges() {
  const { session } = useAuth();
  const { data: challenges = [], isLoading } = useChallengesList();

  const mine = session?.user.id;
  const awaitingMe = challenges.filter((c) => c.status === "pending" && c.opponent_id === mine);
  const pendingSent = challenges.filter((c) => c.status === "pending" && c.creator_id === mine);
  const active = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status === "completed" || c.status === "declined");

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-secondary/20" /></div>;
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Battle Arena</h1>
          <p className="text-muted-foreground mt-1">Challenge your peers and climb the ranks.</p>
        </div>
        <NewChallengeDialog disabled={!session} />
      </div>

      {!session && (
        <div className="p-4 text-center bg-muted/30 border border-dashed rounded-2xl text-sm text-muted-foreground">
          Sign in to challenge someone.
        </div>
      )}

      {awaitingMe.length > 0 && (
        <Section title="Awaiting Your Response" icon={Clock}>
          {awaitingMe.map((c) => <ChallengeCard key={c.id} challenge={c} viewerId={mine} />)}
        </Section>
      )}

      {pendingSent.length > 0 && (
        <Section title="Pending" icon={Clock}>
          {pendingSent.map((c) => <ChallengeCard key={c.id} challenge={c} viewerId={mine} />)}
        </Section>
      )}

      <Section title="Active Challenges" icon={Swords}>
        {active.length === 0 ? (
          <EmptyState text="No active challenges. Issue one above." />
        ) : (
          active.map((c) => <ChallengeCard key={c.id} challenge={c} viewerId={mine} />)
        )}
      </Section>

      {completed.length > 0 && (
        <Section title="History" icon={Trophy}>
          {completed.map((c) => <ChallengeCard key={c.id} challenge={c} viewerId={mine} />)}
        </Section>
      )}
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

function PersonBadge({ id, username, role }: { id: string; username: string | null | undefined; role: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className={cn("text-white text-[10px] font-bold", colorForId(id))}>
          {initialsForUsername(username ?? "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">@{username ?? "unknown"}</div>
        {role && <div className="text-[10px] text-muted-foreground">{role}</div>}
      </div>
    </div>
  );
}

function ChallengeCard({ challenge: c, viewerId }: { challenge: Challenge; viewerId: string | undefined }) {
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
  const direction = challengeDirection(c.creator?.role, c.opponent?.role);
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
          <PersonBadge id={c.creator_id} username={c.creator?.username} role={c.creator?.role} />
          <div className="flex items-center gap-2 shrink-0 text-sm font-bold tabular-nums">
            <span className={cn(c.winner_id === c.creator_id && "text-emerald-500")}>{c.score_creator}</span>
            <span className="text-muted-foreground text-xs font-normal">vs</span>
            <span className={cn(c.winner_id === c.opponent_id && "text-emerald-500")}>{c.score_opponent}</span>
          </div>
          <PersonBadge id={c.opponent_id} username={c.opponent?.username} role={c.opponent?.role} />
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

function NewChallengeDialog({ disabled }: { disabled: boolean }) {
  const { data: directory = [] } = useDirectory();
  const createChallenge = useCreateChallenge();
  const [isOpen, setIsOpen] = useState(false);
  const [opponentId, setOpponentId] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [punishment, setPunishment] = useState("");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return format(d, "yyyy-MM-dd");
  }, []);

  const reset = () => {
    setOpponentId(""); setTopic(""); setDescription("");
    setReward(""); setPunishment(""); setEndsAt(null); setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentId || !topic.trim() || !endsAt) return;
    setError(null);
    createChallenge.mutate(
      {
        opponentId,
        topic: topic.trim(),
        description: description.trim(),
        reward: reward.trim(),
        punishment: punishment.trim(),
        endsAt: new Date(endsAt + "T23:59:59").toISOString(),
      },
      {
        onSuccess: () => { setIsOpen(false); reset(); },
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="shrink-0" disabled={disabled}>
          <Plus className="w-4 h-4 mr-2" /> Issue Challenge
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue a New Challenge</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <label className="text-sm font-medium">Opponent</label>
            <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select...</option>
              {directory.map((p) => {
                const meta = [p.role, p.department].filter(Boolean).join(" · ");
                return <option key={p.id} value={p.id}>@{p.username}{meta ? ` (${meta})` : ""}</option>;
              })}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Most upsells this week"
              required
              maxLength={200}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rules, context, anything they should know"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reward</label>
              <input
                type="text"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="e.g. Loser buys lunch"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Punishment</label>
              <input
                type="text"
                value={punishment}
                onChange={(e) => setPunishment(e.target.value)}
                placeholder="e.g. 20 push-ups"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ends</label>
            <DatePicker value={endsAt} onChange={setEndsAt} minDate={tomorrow} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="secondary" className="w-full mt-2" disabled={createChallenge.isPending}>
            {createChallenge.isPending ? "Sending..." : "Throw Gauntlet"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
