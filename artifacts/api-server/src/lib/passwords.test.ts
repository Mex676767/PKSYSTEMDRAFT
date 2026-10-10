import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, isValidNewPassword, verifyPassword } from "./passwords.ts";

test("password hash verifies the original password only", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("incorrect horse battery staple", encoded), false);
});

test("unknown and malformed legacy password formats are rejected", async () => {
  assert.equal(await verifyPassword("password", "$2a$10$legacy-bcrypt-hash"), false);
  assert.equal(await verifyPassword("password", "not-a-password-hash"), false);
});

test("new password policy enforces length bounds", () => {
  assert.equal(isValidNewPassword("short"), false);
  assert.equal(isValidNewPassword("a".repeat(12)), true);
  assert.equal(isValidNewPassword("a".repeat(128)), true);
  assert.equal(isValidNewPassword("a".repeat(129)), false);
});
