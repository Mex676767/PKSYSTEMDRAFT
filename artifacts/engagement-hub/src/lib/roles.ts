export const ROLES = ["CEO", "HOD", "MANAGER", "SPV", "ASPV", "TL", "ATL", "SNR", "JNR"] as const;
export type Role = (typeof ROLES)[number];

export function roleRank(role: string | null | undefined): number | null {
  if (!role) return null;
  const idx = ROLES.indexOf(role as Role);
  return idx === -1 ? null : idx;
}

export function compareRoles(a: string | null | undefined, b: string | null | undefined): number | null {
  const ra = roleRank(a);
  const rb = roleRank(b);
  if (ra === null || rb === null) return null;
  return rb - ra;
}

export const DEPARTMENTS = ["RTN VIP", "RTN EXC", "MANAGEMENT", "DESIGN", "DATA ANALYST", "MARKETING"] as const;
export type Department = (typeof DEPARTMENTS)[number];

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
