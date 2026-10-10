import assert from "node:assert/strict";
import test from "node:test";
import { isValidAvatarUrl } from "./avatar-url.ts";

const userId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

test("accepts each built-in avatar preset identifier", () => {
  for (const preset of ["fox", "cat", "panda", "robot", "alien", "ghost", "unicorn", "dragon", "owl", "koala", "penguin", "lion", "octopus", "shark", "wizard", "ninja"]) {
    assert.equal(isValidAvatarUrl(`preset:${preset}`, userId), true, preset);
  }
});

test("accepts null, HTTPS photos, and the user's own uploaded avatar", () => {
  assert.equal(isValidAvatarUrl(null, userId), true);
  assert.equal(isValidAvatarUrl("https://images.example.com/avatar.png", userId), true);
  assert.equal(isValidAvatarUrl(`/api/files/${userId}/avatar.png?t=1730000000000`, userId), true);
});

test("rejects unknown presets, another user's files, and unsafe data URLs", () => {
  assert.equal(isValidAvatarUrl("preset:unknown", userId), false);
  assert.equal(isValidAvatarUrl("preset:fox?next=https://example.com", userId), false);
  assert.equal(isValidAvatarUrl("/api/files/550e8400-e29b-41d4-a716-446655440000/avatar.png", userId), false);
  assert.equal(isValidAvatarUrl("data:image/svg+xml,<svg onload=alert(1) />", userId), false);
  assert.equal(isValidAvatarUrl("javascript:alert(1)", userId), false);
  assert.equal(isValidAvatarUrl("x".repeat(2049), userId), false);
});
