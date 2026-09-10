// Ordered highest to lowest -- the index doubles as the numeric rank used
// by the challenge Upline/Downline/Same-role logic, mirroring role_rank()
// in role-department-setup.sql. Keep the two in sync if this list changes.
export const ROLES = ["CEO", "HOD", "MANAGER", "SPV", "ASPV", "TL", "ATL", "SNR", "JNR"] as const;
export type Role = (typeof ROLES)[number];

export function roleRank(role: string | null | undefined): number | null {
  if (!role) return null;
  const idx = ROLES.indexOf(role as Role);
  return idx === -1 ? null : idx;
}

/** Positive when `a` outranks `b` (is more senior), negative when `a` is more junior, 0 when equal. Null if either has no role set. */
export function compareRoles(a: string | null | undefined, b: string | null | undefined): number | null {
  const ra = roleRank(a);
  const rb = roleRank(b);
  if (ra === null || rb === null) return null;
  return rb - ra; // lower rank number = more senior, so flip the subtraction
}

export const DEPARTMENTS = ["RTN VIP", "RTN EXC", "MANAGEMENT", "DESIGN", "DATA ANALYST", "MARKETING"] as const;
export type Department = (typeof DEPARTMENTS)[number];

// Challenge "level": derived from both people's role at display time
// (rather than stored) so it can't go stale if someone's role changes
// after the challenge is created.
export function challengeDirection(
  creatorRole: string | null | undefined,
  opponentRole: string | null | undefined
): "upline" | "downline" | "same" | "unranked" {
  const cmp = compareRoles(creatorRole, opponentRole);
  if (cmp === null) return "unranked";
  if (cmp > 0) return "upline";
  if (cmp < 0) return "downline";
  return "same";
}

export const CHALLENGE_DIRECTION_LABEL: Record<ReturnType<typeof challengeDirection>, string> = {
  upline: "Upline vs Downline",
  downline: "Downline vs Upline",
  same: "Same Role",
  unranked: "Unranked",
};
