import { createHmac } from "node:crypto";

export interface TurnRestCredentials {
  username: string;
  credential: string;
  expiresAt: number;
}

export function createTurnRestCredentials(
  userId: string,
  sharedSecret: string,
  nowMs = Date.now(),
  ttlSeconds = 600,
): TurnRestCredentials {
  if (!userId || !sharedSecret || !Number.isFinite(nowMs) || !Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
    throw new Error("Invalid TURN credential configuration.");
  }
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const username = `${expiresAt}:${userId}`;
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64");
  return { username, credential, expiresAt };
}
