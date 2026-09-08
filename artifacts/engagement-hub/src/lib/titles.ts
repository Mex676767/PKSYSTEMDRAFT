// Titles are unlocked server-side (see award_title() calls in the SQL
// triggers/functions), keyed by these same strings. This is just the
// display metadata for whatever's in a profile's unlocked_titles array.
export const TITLE_CATALOG: Record<string, { label: string; description: string }> = {
  newcomer: { label: "Newcomer", description: "Joined the team" },
  goal_getter: { label: "Goal Getter", description: "Completed your first goal" },
  overachiever: { label: "Overachiever", description: "Completed 5 goals" },
  streak_starter: { label: "Streak Starter", description: "3-day login streak" },
  streak_master: { label: "Streak Master", description: "7-day login streak" },
  record_holder: { label: "Record Holder", description: "Claimed a Hall of Fame record" },
  philanthropist: { label: "Philanthropist", description: "Gifted points to a teammate" },
  word_wizard: { label: "Word Wizard", description: "Solved the daily Wordle" },
  quiz_whiz: { label: "Quiz Whiz", description: "Answered 5 quiz questions correctly" },
};

export function titleLabel(key: string) {
  return TITLE_CATALOG[key]?.label ?? key;
}
