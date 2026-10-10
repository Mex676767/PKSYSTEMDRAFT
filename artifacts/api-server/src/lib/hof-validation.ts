export type WinnerDraft = {
  rank: number;
  user_id: string;
  achievement: string;
  team_member_ids: string[];
};

export function validateWinnerSet(
  awardType: "individual" | "team",
  winners: WinnerDraft[],
): string | null {
  if (winners.length > 300) return "At most 300 winner rows are allowed.";
  const assigned = new Set<string>();
  const rankCounts = new Map<number, number>();

  for (const winner of winners) {
    if (!Number.isInteger(winner.rank) || winner.rank < 1 || winner.rank > 3) return "Winner rank must be between 1 and 3.";
    if (winner.achievement.length > 150) return "Achievement text is too long.";
    const count = (rankCounts.get(winner.rank) ?? 0) + 1;
    rankCounts.set(winner.rank, count);
    if (count > 100) return "At most 100 tied winners are allowed per place.";
    if (awardType === "team" && count > 1) return "Team awards allow one leader per place.";
    if (awardType === "individual" && winner.team_member_ids.length > 0) return "Individual awards cannot include team members.";
    if (new Set(winner.team_member_ids).size !== winner.team_member_ids.length || winner.team_member_ids.includes(winner.user_id)) {
      return "A team member cannot be repeated or listed as the leader.";
    }
    for (const personId of [winner.user_id, ...winner.team_member_ids]) {
      if (assigned.has(personId)) return "A person can only appear once on this podium.";
      assigned.add(personId);
    }
  }
  return null;
}
