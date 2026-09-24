// Defaults, used until the Admin-managed tables exist (migration 0027) and as
// a fallback. Live lists come from useOrgStructure().
export const DEFAULT_ROLES = ["CEO", "HOD", "MANAGER", "SPV", "ASPV", "TL", "ATL", "SNR", "JNR"];
export const DEFAULT_DEPARTMENTS = ["RTN VIP", "RTN EXC", "MANAGEMENT", "DESIGN", "DATA ANALYST", "MARKETING"];
/** @deprecated use useOrgStructure().roles */
export const ROLES = DEFAULT_ROLES;
/** @deprecated use useOrgStructure().departments */
export const DEPARTMENTS = DEFAULT_DEPARTMENTS;
export type Role = string;
export type Department = string;

/** Position in the hierarchy (0 = most senior), given the roles in order. */
export function roleRank(role: string | null | undefined, roles: readonly string[] = DEFAULT_ROLES): number | null {
  if (!role) return null;
  const idx = roles.indexOf(role);
  return idx === -1 ? null : idx;
}

export function compareRoles(a: string | null | undefined, b: string | null | undefined, roles: readonly string[] = DEFAULT_ROLES): number | null {
  const ra = roleRank(a, roles);
  const rb = roleRank(b, roles);
  if (ra === null || rb === null) return null;
  return rb - ra;
}

export function challengeDirection(
  creatorRole: string | null | undefined,
  opponentRole: string | null | undefined,
  roles: readonly string[] = DEFAULT_ROLES
): "upline" | "downline" | "same" | "unranked" {
  const cmp = compareRoles(creatorRole, opponentRole, roles);
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
