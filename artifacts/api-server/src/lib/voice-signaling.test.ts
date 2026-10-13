import assert from "node:assert/strict";
import { test } from "node:test";
import { validSignalAcknowledgments } from "./voice-signaling.ts";

test("accepts PostgreSQL bigint IDs without JavaScript precision loss", () => {
  assert.equal(validSignalAcknowledgments([]), true);
  assert.equal(validSignalAcknowledgments(["1", "9007199254740993", "9223372036854775807"]), true);
});

test("rejects invalid or oversized acknowledgment batches", () => {
  for (const value of [null, {}, [1], ["0"], ["-1"], ["1.5"], ["1e3"], ["9223372036854775808"], Array(101).fill("1")]) {
    assert.equal(validSignalAcknowledgments(value), false);
  }
});
