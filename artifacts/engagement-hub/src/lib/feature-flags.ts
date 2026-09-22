export const LOCKED_ROUTES = new Set<string>([
  "/mentors",
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
