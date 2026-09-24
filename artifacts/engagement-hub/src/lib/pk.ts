// PK / Battle Arena shared types and labels. Rules live in the database
// (supabase/migrations/0030-0038); see docs/PK-SYSTEM.md.

export type PkStatus =
  | "awaiting_opponent"
  | "countered"
  | "awaiting_approval"
  | "rejected"
  | "cancelled"
  | "expired"
  | "declined"
  | "active"
  | "settlement_requested"
  | "awaiting_playbook"
  | "awaiting_verification"
  | "settled"
  | "terminated";

export type PkMethod = "named" | "open";
export type PkFormat = "head_to_head" | "self_declaration";
export type PkType = "one_v_one" | "vs_upline" | "team";
export type PkDirection = "higher" | "lower";
export type PkScoring = "absolute" | "improvement" | "completion";

export type PkPerson = {
  username: string | null;
  role: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory?: string | null;
};

export type PkParticipant = {
  user_id: string;
  side: "A" | "B";
  is_captain: boolean;
  accepted_at: string | null;
  baseline: number | null;
  target: number | null;
  current_value: number | null;
  profile: PkPerson | null;
};

export type Pk = {
  id: string;
  pk_version: number;
  creator_id: string;
  opponent_id: string | null;
  topic: string;
  description: string | null;
  metric: string | null;
  metric_definition: string | null;
  direction: PkDirection | null;
  scoring: PkScoring | null;
  format: PkFormat | null;
  method: PkMethod | null;
  pk_type: PkType | null;
  department: string | null;
  winning_target: number | null;
  starts_at: string;
  ends_at: string;
  update_frequency: string | null;
  reward: string | null;
  punishment: string | null;
  pk_money: number;
  proof_method: string | null;
  tiebreaker: string | null;
  status: PkStatus;
  counter_round: number;
  terms_version: number;
  expires_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_note: string | null;
  created_at: string;
  winner_side: "A" | "B" | null;
  winner_id: string | null;
  final_score_a: number | null;
  final_score_b: number | null;
  early_settlement: boolean;
  settlement_requested_at: string | null;
  settled_at: string | null;
  participants: PkParticipant[];
};

export type PkPlaybook = {
  challenge_id: string;
  author_id: string | null;
  what_extra: string;
  what_worked: string;
  how_to_copy: string;
  created_at: string;
  updated_at: string;
};

export type PkLeaderRow = {
  user_id: string;
  username: string | null;
  role: string | null;
  department: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  win_pct: number | null;
  streak: number;
  rank: number;
};

export type PkChampion = {
  period_start: string;
  department: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  active_border: string | null;
  active_accessory: string | null;
  points: number;
  wins: number;
};

/** Calendar quarter start (yyyy-MM-dd) for a date, as the database does it. */
export function quarterStart(d: Date) {
  const m = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
}

export function quarterLabel(start: string) {
  const [y, m] = start.split("-").map(Number);
  return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
}

/** The current quarter and the ones before it, newest first. */
export function recentQuarters(count: number, now = new Date()) {
  const out: string[] = [];
  const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  for (let i = 0; i < count; i++) {
    out.push(quarterStart(d));
    d.setMonth(d.getMonth() - 3);
  }
  return out;
}

export type PkTerms = {
  method: PkMethod;
  format: PkFormat;
  team: boolean;
  title: string;
  description: string;
  metric: string;
  metric_definition: string;
  direction: PkDirection;
  scoring: PkScoring | null;
  winning_target: string;
  starts_at: string;
  ends_at: string;
  update_frequency: string;
  reward: string;
  punishment: string;
  pk_money: string;
  proof_method: string;
  tiebreaker: string;
  compliance_agreed: boolean;
  creator: { baseline: string; target: string };
  participants: { user_id: string; side: "A" | "B"; is_captain: boolean; baseline: string; target: string }[];
};

export const PK_STATUS_LABEL: Record<PkStatus, string> = {
  awaiting_opponent: "Waiting for response",
  countered: "Counter-proposal",
  awaiting_approval: "Waiting for approval",
  rejected: "Not approved",
  cancelled: "Cancelled",
  expired: "Expired",
  declined: "Declined",
  active: "Live",
  settlement_requested: "Settling",
  awaiting_playbook: "Winner's playbook due",
  awaiting_verification: "Confirming result",
  settled: "Settled",
  terminated: "Terminated",
};

export const PK_TYPE_LABEL: Record<PkType, string> = {
  one_v_one: "1v1",
  vs_upline: "vs Upline",
  team: "Team",
};

export const PK_SCORING_LABEL: Record<PkScoring, string> = {
  absolute: "Highest total",
  improvement: "Biggest improvement",
  completion: "Completion rate",
};

export const PK_SCORING_HINT: Record<PkScoring, string> = {
  absolute: "Whoever ends with the best number wins.",
  improvement: "Everyone gives a starting baseline. The biggest gain on their own baseline wins.",
  completion: "Everyone sets a target. The highest % of target reached wins.",
};

/** Statuses where the PK is still being set up. */
export const PK_SETUP: PkStatus[] = ["awaiting_opponent", "countered", "awaiting_approval"];
/** Statuses where the PK is running or being settled. */
export const PK_LIVE: PkStatus[] = ["active", "settlement_requested", "awaiting_playbook", "awaiting_verification"];
/** Finished, one way or another. */
export const PK_CLOSED: PkStatus[] = ["rejected", "cancelled", "expired", "declined", "settled", "terminated"];

export function pkStatusTone(status: PkStatus) {
  if (status === "active") return "bg-primary text-primary-foreground";
  if (PK_SETUP.includes(status) || status === "awaiting_playbook" || status === "awaiting_verification") return "bg-amber-500 text-white";
  if (status === "settled") return "bg-emerald-500 text-white";
  return "bg-muted text-muted-foreground";
}

export function pkSide(pk: Pk, side: "A" | "B") {
  return pk.participants.filter((p) => p.side === side).sort((a, b) => Number(b.is_captain) - Number(a.is_captain));
}

/** Score units for a side, matching pk_side_scores in the database. */
export function pkScoreSuffix(pk: Pk) {
  if (pk.format === "self_declaration" || pk.scoring === "completion") return "%";
  return "";
}

export function formatPkNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Terms form values from an existing PK, for counter-proposals. */
export function termsFromPk(pk: Pk): PkTerms {
  const str = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const creator = pk.participants.find((p) => p.user_id === pk.creator_id);
  return {
    method: pk.method ?? "named",
    format: pk.format ?? "head_to_head",
    team: pk.pk_type === "team",
    title: pk.topic,
    description: pk.description ?? "",
    metric: pk.metric ?? "",
    metric_definition: pk.metric_definition ?? "",
    direction: pk.direction ?? "higher",
    scoring: pk.scoring,
    winning_target: str(pk.winning_target),
    starts_at: pk.starts_at.slice(0, 10),
    ends_at: pk.ends_at.slice(0, 10),
    update_frequency: pk.update_frequency ?? "",
    reward: pk.reward ?? "",
    punishment: pk.punishment ?? "",
    pk_money: pk.pk_money ? String(pk.pk_money) : "",
    proof_method: pk.proof_method ?? "",
    tiebreaker: pk.tiebreaker ?? "",
    compliance_agreed: true,
    creator: { baseline: str(creator?.baseline), target: str(creator?.target) },
    participants: pk.participants
      .filter((p) => p.user_id !== pk.creator_id)
      .map((p) => ({ user_id: p.user_id, side: p.side, is_captain: p.is_captain, baseline: str(p.baseline), target: str(p.target) })),
  };
}
