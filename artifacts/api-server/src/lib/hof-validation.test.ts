import assert from "node:assert/strict";
import test from "node:test";
import { validateWinnerSet, type WinnerDraft } from "./hof-validation.ts";

const userA = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const userB = "550e8400-e29b-41d4-a716-446655440000";
const userC = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

function winner(rank: number, user_id: string, team_member_ids: string[] = []): WinnerDraft {
  return { rank, user_id, achievement: "", team_member_ids };
}

test("Individual awards allow tied winners at the same place", () => {
  assert.equal(validateWinnerSet("individual", [winner(1, userA), winner(1, userB)]), null);
});

test("Team awards allow one leader and list members beneath that leader", () => {
  assert.equal(validateWinnerSet("team", [winner(1, userA, [userB, userC])]), null);
});

test("Team awards reject tied leaders at the same place", () => {
  assert.match(validateWinnerSet("team", [winner(1, userA), winner(1, userB)] ) ?? "", /one leader/);
});

test("A person cannot be assigned twice across leaders and members", () => {
  assert.match(validateWinnerSet("team", [winner(1, userA, [userB]), winner(2, userB)]) ?? "", /only appear once/);
});

test("Individual awards cannot carry team members", () => {
  assert.match(validateWinnerSet("individual", [winner(1, userA, [userB])]) ?? "", /cannot include team members/);
});
