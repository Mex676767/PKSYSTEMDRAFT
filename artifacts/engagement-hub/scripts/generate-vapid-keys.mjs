// Prints a fresh VAPID key pair for browser push notifications.
// Run from artifacts/engagement-hub:  node scripts/generate-vapid-keys.mjs
// See supabase/PUSH-NOTIFICATIONS.md for where each value goes.
const { webcrypto: crypto } = await import("node:crypto");

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const publicKey = b64url(await crypto.subtle.exportKey("raw", keys.publicKey));
const privateKey = (await crypto.subtle.exportKey("jwk", keys.privateKey)).d;

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
