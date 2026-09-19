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

export const DISCORD_INTEGRATION_ENABLED = true;

const DISCORD_EXEMPT_EMAILS = new Set(["mexhawoobin@gmail.com"]);

export function requiresDiscordConnect(profile: { email?: string | null; discord_id?: string | null } | null | undefined) {
  if (!DISCORD_INTEGRATION_ENABLED) return false;
  if (profile?.discord_id) return false;
  if (profile?.email && DISCORD_EXEMPT_EMAILS.has(profile.email)) return false;
  return true;
}
