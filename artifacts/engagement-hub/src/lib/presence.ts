export type PresenceStatusColor = "green" | "cyan" | "violet" | "amber" | "blue" | "gray";

export const PRESENCE_DOT_CLASS: Record<PresenceStatusColor, string> = {
  green: "bg-emerald-500",
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  gray: "bg-zinc-400/50",
};

export const PRESENCE_BADGE_CLASS: Record<PresenceStatusColor, string> = {
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blue: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  gray: "bg-zinc-400/10 text-muted-foreground",
};

const ROUTE_ACTIVITY: { test: (path: string) => boolean; label: string }[] = [
  { test: (p) => p === "/", label: "On the Dashboard" },
  { test: (p) => p === "/goals", label: "Browsing Goals" },
  { test: (p) => p === "/birthdays", label: "Browsing Birthdays" },
  { test: (p) => p === "/social", label: "Browsing Social" },
  { test: (p) => p === "/challenges", label: "Browsing Challenges" },
  { test: (p) => p === "/hall-of-fame", label: "Browsing Hall of Fame" },
  { test: (p) => p === "/mentors", label: "Browsing Mentors" },
  { test: (p) => p === "/lottery", label: "Checking Lucky Draw" },
  { test: (p) => p === "/games", label: "Browsing Games" },
  { test: (p) => p === "/games/wordle", label: "Playing Wordle" },
  { test: (p) => p === "/games/desk-setup", label: "Browsing Desk Setups" },
  { test: (p) => p === "/games/quiz", label: "Playing the Quiz" },
  { test: (p) => p === "/betting", label: "Browsing Betting" },
  { test: (p) => p === "/messages", label: "Checking Messages" },
  { test: (p) => p === "/profile", label: "Editing Profile" },
  { test: (p) => p === "/admin", label: "In the Admin panel" },
  { test: (p) => p === "/voice", label: "Browsing Voice Channels" },
];

export function activityLabelForPath(path: string): string {
  return ROUTE_ACTIVITY.find((r) => r.test(path))?.label ?? "Browsing the site";
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}
