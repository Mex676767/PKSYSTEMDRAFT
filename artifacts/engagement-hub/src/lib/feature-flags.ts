// Launch scope: only Social, Goals, and Challenges are real for now. Every
// other feature stays visible in the nav (so people know it's coming) but
// routes to a locked placeholder instead of the real page. Flip an entry
// out of this set to re-enable it once it's ready -- nothing else needs to
// change, the real page component is untouched underneath.
export const LOCKED_ROUTES = new Set<string>([
  "/hall-of-fame",
  "/mentors",
  "/birthdays",
  "/lottery",
  "/games",
  "/games/wordle",
  "/games/desk-setup",
  "/games/quiz",
  "/betting",
]);

export function isRouteLocked(path: string) {
  return LOCKED_ROUTES.has(path);
}
