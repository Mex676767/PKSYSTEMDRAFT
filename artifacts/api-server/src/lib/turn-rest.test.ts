import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createTurnRestCredentials } from "./turn-rest.ts";

test("TURN REST credentials are user-scoped and expire after the configured TTL", () => {
  const now = 1_700_000_000_000;
  const result = createTurnRestCredentials("user-123", "shared-secret", now, 600);

  assert.equal(result.expiresAt, 1_700_000_600);
  assert.equal(result.username, "1700000600:user-123");
  assert.equal(result.credential, createHmac("sha1", "shared-secret").update(result.username).digest("base64"));
  assert.notEqual(result.credential, createHmac("sha1", "shared-secret").update("1700000600:user-456").digest("base64"));
});

test("TURN REST credentials reject missing secrets and unsafe TTLs", () => {
  assert.throws(() => createTurnRestCredentials("user-123", "", 1_700_000_000_000));
  assert.throws(() => createTurnRestCredentials("user-123", "secret", 1_700_000_000_000, 30));
  assert.throws(() => createTurnRestCredentials("user-123", "secret", 1_700_000_000_000, 3601));
});
