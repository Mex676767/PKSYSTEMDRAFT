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
export type PkType = "one_v_one" | "vs_upline" | "team" | "department";
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
  completed_properly: boolean;
  stopped_updates_at: string | null;
  stopped_updates_note: string | null;
  profile: PkPerson | null;
};

export type Pk = {
  id: string;
  pk_version: number;
  rules_version: string;
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
  base_tier: 5 | 8 | 10 | null;
  tier_reason: string | null;
  upgrade_tier: 8 | 10 | null;
  upgrade_requirement: string | null;
  upgrade_evidence: string | null;
  upgrade_completed: boolean;
  effective_tier: 5 | 8 | 10 | null;
  tier_approved_by: string | null;
  tier_approved_at: string | null;
  tier_disputed_by: string | null;
  tier_disputed_at: string | null;
  tier_dispute_note: string | null;
  stake_kind: "honour" | "title" | "task" | "privilege" | "pk_points" | null;
  point_stake: number;
  is_revenge: boolean;
  opponent_department: string | null;
  settled_month: string | null;
  scoring_breakdown: Record<string, unknown>[] | null;
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
  terminated_reason: PkTerminateReason | null;
  terminated_note: string | null;
  terminated_at: string | null;
  participants: PkParticipant[];
};

export type PkTerminateReason = "resignation" | "transfer" | "data_failure" | "customer_pool_change" | "emergency" | "other";

export const PK_TERMINATE_REASONS: Record<PkTerminateReason, string> = {
  resignation: "Resignation",
  transfer: "Transfer",
  data_failure: "Data or system failure",
  customer_pool_change: "Customer pool change",
  emergency: "Emergency",
  other: "Other special case",
};

export type PkDebt = {
  id: string;
  challenge_id: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  paid_at: string | null;
  created_at: string;
  debtor: { username: string | null } | null;
  creditor: { username: string | null } | null;
  challenge?: { topic: string } | null;
};

export type PkMoneySummary = {
  month_start: string;
  allowance: number;
  used: number;
  remaining: number;
  owed_to_me: number;
  i_owe: number;
};

export type PkLibraryEntry = PkPlaybook & {
  author: { username: string | null; role: string | null; avatar_url: string | null; active_border: string | null; active_accessory: string | null } | null;
  challenge: Pick<Pk, "id" | "topic" | "metric" | "department" | "pk_type" | "format" | "scoring" | "direction" | "settled_at" | "final_score_a" | "final_score_b" | "winner_side" | "status"> | null;
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

/** Calendar month start (yyyy-MM-dd) for a date, as the v3.43 database does it. */
export function monthStart(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(start: string) {
  const [y, m] = start.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function recentMonths(count: number, now = new Date()) {
  const out: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < count; i++) {
    out.push(monthStart(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export type PkTerms = {
  method: PkMethod;
  format: PkFormat;
  team: boolean;
  match_type: PkType;
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
  base_tier: "5" | "8" | "10";
  tier_reason: string;
  company_metric: boolean;
  upgrade_tier: "" | "8" | "10";
  upgrade_requirement: string;
  stake_kind: "" | "honour" | "title" | "task" | "privilege" | "pk_points";
  point_stake: string;
  is_revenge: boolean;
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
  department: "Department vs Department",
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
    match_type: pk.pk_type ?? "one_v_one",
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
    base_tier: String(pk.base_tier ?? 5) as "5" | "8" | "10",
    tier_reason: pk.tier_reason ?? "",
    company_metric: pk.format === "self_declaration" && pk.base_tier === 10,
    upgrade_tier: pk.upgrade_tier ? String(pk.upgrade_tier) as "8" | "10" : "",
    upgrade_requirement: pk.upgrade_requirement ?? "",
    stake_kind: pk.stake_kind ?? "",
    point_stake: pk.point_stake ? String(pk.point_stake) : "",
    is_revenge: pk.is_revenge,
    proof_method: pk.proof_method ?? "",
    tiebreaker: pk.tiebreaker ?? "",
    compliance_agreed: true,
    creator: { baseline: str(creator?.baseline), target: str(creator?.target) },
    participants: pk.participants
      .filter((p) => p.user_id !== pk.creator_id)
      .map((p) => ({ user_id: p.user_id, side: p.side, is_captain: p.is_captain, baseline: str(p.baseline), target: str(p.target) })),
  };
}

/** Update frequencies the reminders understand (pk_update_interval in the database). */
export const PK_UPDATE_FREQUENCIES = [
  { value: "Daily", hint: "Good for PKs of a week or two" },
  { value: "Every 2 days", hint: "" },
  { value: "Every 3 days", hint: "" },
  { value: "Weekly", hint: "Handbook minimum for longer PKs" },
  { value: "Every 2 weeks", hint: "" },
  { value: "Monthly", hint: "" },
] as const;

export type PkSettings = {
  open_expiry_days: number;
  max_counter_rounds: number;
  bonus_stacking: "additive" | "multiplicative";
  prize_pic: string;
  prize_amount: string;
  penalty_pic: string;
  penalty_notice: string;
  reminders_enabled: boolean;
  announce_live: boolean;
  announce_winner: boolean;
};

export type PkViolation = {
  id: string;
  challenge_id: string;
  user_id: string;
  kind: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  required_update: string | null;
  consequence: string | null;
  monthly_count: number | null;
  ban_start: string | null;
  ban_end: string | null;
  person: { username: string | null } | null;
  challenge: { topic: string } | null;
};
