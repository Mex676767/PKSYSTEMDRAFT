import { Link } from "wouter";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Clock, Crown, DollarSign, Gift, Megaphone, Skull } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { usePkSideScores } from "@/hooks/use-pk";
import {
  PK_LIVE, PK_STATUS_LABEL, PK_TYPE_LABEL, formatPkNumber, pkScoreSuffix, pkSide, pkStatusTone,
  type Pk, type PkParticipant,
} from "@/lib/pk";
import { cn } from "@/lib/utils";

export function PkAvatar({ p, className }: { p: PkParticipant; className?: string }) {
  const name = p.profile?.username ?? "unknown";
  return (
    <UserAvatar
      user={{ name, initials: initialsForUsername(name), color: colorForId(p.user_id) }}
      photoUrl={p.profile?.avatar_url}
      border={p.profile?.active_border}
      accessory={p.profile?.active_accessory}
      className={cn("w-10 h-10 text-xs", className)}
    />
  );
}

/** One side of the VS layout: a single person, or a stacked team. */
export function PkSideBlock({ people, align, placeholder }: { people: PkParticipant[]; align: "left" | "right"; placeholder?: string }) {
  if (people.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 min-w-0 flex-1", align === "right" && "flex-row-reverse text-right")}>
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground truncate">{placeholder ?? "Open"}</span>
      </div>
    );
  }
  const lead = people[0];
  return (
    <div className={cn("flex items-center gap-2 min-w-0 flex-1", align === "right" && "flex-row-reverse text-right")}>
      <div className={cn("flex shrink-0", align === "right" ? "flex-row-reverse -space-x-reverse -space-x-3" : "-space-x-3")}>
        {people.slice(0, 3).map((p) => <PkAvatar key={p.user_id} p={p} className="ring-2 ring-background" />)}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1" style={{ justifyContent: align === "right" ? "flex-end" : undefined }}>
          {people.length > 1 && lead.is_captain && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
          @{lead.profile?.username ?? "unknown"}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {people.length > 1 ? `+${people.length - 1} more` : lead.profile?.role}
        </div>
      </div>
    </div>
  );
}

/** What the viewer needs to do on this PK, if anything. */
export function pkNextStep(pk: Pk, viewerId: string | undefined, canApprove: boolean): string | null {
  const me = pk.participants.find((p) => p.user_id === viewerId);
  if ((pk.status === "awaiting_opponent" || pk.status === "countered") && me && !me.accepted_at) return "Your move: accept, counter or decline";
  if (pk.status === "awaiting_opponent" && pk.method === "open" && !me) return "Open to you. First to accept takes it";
  if (pk.status === "awaiting_approval" && canApprove) return "Needs your approval";
  if (pk.status === "rejected" && me) return pk.review_note ? `Not approved: ${pk.review_note}` : "Not approved";
  return null;
}

export function PkCard({ pk, viewerId, canApprove }: { pk: Pk; viewerId: string | undefined; canApprove: boolean }) {
  const live = PK_LIVE.includes(pk.status);
  const { data: sides = [] } = usePkSideScores(pk.id, live);
  const a = pkSide(pk, "A");
  const b = pkSide(pk, "B");
  const isSelf = pk.format === "self_declaration";
  const suffix = pkScoreSuffix(pk);
  const scoreOf = (side: "A" | "B") => sides.find((s) => s.side === side)?.score ?? null;
  const next = pkNextStep(pk, viewerId, canApprove);
  const involved = pk.participants.some((p) => p.user_id === viewerId);

  return (
    <Link href={`/challenges/${pk.id}`}>
      <Card className={cn("shadow-sm cursor-pointer transition-colors hover:border-secondary/60", involved && "border-secondary/30", next && "ring-1 ring-amber-500/50")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{pk.topic}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{pk.metric} · {pk.direction === "lower" ? "lower wins" : "higher wins"}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {pk.pk_type && <span className="text-[9px] border rounded-full px-1.5 py-0.5">{PK_TYPE_LABEL[pk.pk_type]}</span>}
              {isSelf && <span className="text-[9px] border rounded-full px-1.5 py-0.5">Self-declared</span>}
              <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", pkStatusTone(pk.status))}>
                {pk.method === "open" && pk.status === "awaiting_opponent" ? "Open" : PK_STATUS_LABEL[pk.status]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PkSideBlock people={a} align="left" />
            <div className="shrink-0 text-center">
              {live ? (
                <div className="text-sm font-bold tabular-nums">
                  {formatPkNumber(scoreOf("A"))}{suffix}
                  {!isSelf && <><span className="text-muted-foreground text-xs font-normal mx-1.5">vs</span>{formatPkNumber(scoreOf("B"))}{suffix}</>}
                </div>
              ) : (
                <span className="text-xs font-black tracking-widest text-secondary">VS</span>
              )}
              {isSelf && live && <div className="text-[9px] text-muted-foreground">of target</div>}
            </div>
            <PkSideBlock people={b} align="right" placeholder={isSelf ? "Who'll bet against?" : "Open slot"} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {pk.status === "awaiting_opponent" && pk.expires_at
                ? `Expires in ${formatDistanceToNowStrict(new Date(pk.expires_at))}`
                : `${format(new Date(pk.starts_at), "MMM d")} to ${format(new Date(pk.ends_at), "MMM d, yyyy")}`}
            </span>
            {pk.reward && <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 rounded-full px-2 py-0.5"><Gift className="w-3 h-3" />{pk.reward}</span>}
            {pk.punishment && <span className="flex items-center gap-1 bg-destructive/10 text-destructive rounded-full px-2 py-0.5"><Skull className="w-3 h-3" />{pk.punishment}</span>}
            {pk.pk_money > 0 && <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5"><DollarSign className="w-3 h-3" />{formatPkNumber(pk.pk_money)}</span>}
          </div>

          {next && <p className="text-xs font-medium text-amber-600 dark:text-amber-400 border-t border-border/50 pt-2">{next}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
