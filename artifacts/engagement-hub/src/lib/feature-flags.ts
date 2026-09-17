export const LOCKED_ROUTES = new Set<string>([
  "/hall-of-fame",
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

// Flip to true once the Discord bot, OAuth app, and DB migration are set up.
export const DISCORD_INTEGRATION_ENABLED = false;
