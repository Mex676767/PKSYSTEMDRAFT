const PRESET_AVATARS = new Set([
  "fox", "cat", "panda", "robot", "alien", "ghost", "unicorn", "dragon",
  "owl", "koala", "penguin", "lion", "octopus", "shark", "wizard", "ninja",
]);

export function isValidAvatarUrl(avatarUrl: unknown, userId: string): avatarUrl is string | null {
  if (avatarUrl === null) return true;
  if (typeof avatarUrl !== "string" || avatarUrl.length > 2048) return false;

  const ownUploadedAvatar = new RegExp(
    `^/api/files/${userId}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}(?:\\?t=\\d{1,16})?$`,
  ).test(avatarUrl);
  const presetAvatar = /^preset:([a-z-]+)$/.exec(avatarUrl);

  return avatarUrl.startsWith("https://")
    || ownUploadedAvatar
    || (!!presetAvatar && PRESET_AVATARS.has(presetAvatar[1]));
}
