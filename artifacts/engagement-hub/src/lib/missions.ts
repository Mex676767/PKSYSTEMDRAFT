// Activities a mission can count. Keys match the trigger kinds in
// supabase/migrations/0020_mission_activity.sql ('manual' = admin approves).
export const MISSION_KINDS = [
  { key: "login", label: "Log in", unit: "day", help: "Days they open the hub" },
  { key: "post", label: "Create posts", unit: "post", help: "Social posts" },
  { key: "comment", label: "Write comments", unit: "comment", help: "Comments anywhere" },
  { key: "reaction", label: "React to things", unit: "item", help: "Each post/goal counts once" },
  { key: "birthday_wish", label: "Send birthday wishes", unit: "person", help: "Each birthday person counts once" },
  { key: "goal_create", label: "Create goals", unit: "goal", help: "New goals" },
  { key: "goal_update", label: "Update goal progress", unit: "update", help: "Progress updates on goals" },
  { key: "goal_complete", label: "Complete goals", unit: "goal", help: "Goals marked complete" },
  { key: "progress_photo", label: "Upload progress photos", unit: "photo", help: "Progress photos" },
  { key: "quiz_correct", label: "Answer quiz questions correctly", unit: "question", help: "Each question counts once" },
  { key: "wordle_solve", label: "Solve the Wordle", unit: "solve", help: "Daily Wordle solves" },
  { key: "message", label: "Send direct messages", unit: "message", help: "DMs sent" },
  { key: "voice_join", label: "Join voice channels", unit: "session", help: "Voice sessions joined" },
  { key: "manual", label: "Manual (admin approves)", unit: "", help: "They tap “Submit”; an admin approves" },
] as const;

export type MissionKind = (typeof MISSION_KINDS)[number]["key"];
export type MissionCadence = "daily" | "weekly" | "monthly" | "special";

export const CADENCE_LABEL: Record<MissionCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  special: "Special",
};

export function missionKindLabel(kind: string) {
  return MISSION_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export function missionUnit(kind: string, count: number) {
  const unit: string = MISSION_KINDS.find((k) => k.key === kind)?.unit ?? "";
  if (!unit) return "";
  return count === 1 ? unit : unit.endsWith("s") ? unit : `${unit}s`;
}
