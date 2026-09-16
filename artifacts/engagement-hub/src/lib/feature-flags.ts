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
