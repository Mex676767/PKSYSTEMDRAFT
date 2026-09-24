// Minimal Web Push sender built on WebCrypto only (runs in Deno / Supabase
// Edge Functions, and in Node 20+ for testing).
//   - Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
//   - Sender identification: VAPID, RFC 8292 (ES256 JWT)

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Encrypts `payload` for one subscription; returns the aes128gcm request body. */
export async function encryptPayload(payload: Uint8Array, sub: PushSubscriptionKeys): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  const asKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Single record: payload followed by the 0x02 "last record" delimiter.
  const plaintext = concat(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

const signingKeys = new Map<string, Promise<CryptoKey>>();

function vapidSigningKey(vapid: VapidKeys): Promise<CryptoKey> {
  let key = signingKeys.get(vapid.privateKey);
  if (!key) {
    const pub = b64urlDecode(vapid.publicKey);
    if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point");
    key = crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: b64urlEncode(pub.slice(1, 33)),
        y: b64urlEncode(pub.slice(33, 65)),
        d: vapid.privateKey,
        ext: true,
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    signingKeys.set(vapid.privateKey, key);
  }
  return key;
}

/** `Authorization` header value for a push to `endpoint`. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: vapid.subject }))
  );
  const unsigned = `${header}.${claims}`;
  // WebCrypto ECDSA signatures are already raw r||s, which is what JWS wants.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await vapidSigningKey(vapid), enc.encode(unsigned))
  );
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

export type PushResult = { ok: boolean; status: number; gone: boolean; body?: string };

export async function sendPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidKeys,
  opts: { ttlSeconds?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = {}
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(sub.endpoint, vapid),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(opts.ttlSeconds ?? 24 * 3600),
    Urgency: opts.urgency ?? "normal",
  };
  if (opts.topic) headers.Topic = opts.topic;
  const res = await fetch(sub.endpoint, { method: "POST", headers, body });
  const ok = res.status >= 200 && res.status < 300;
  return {
    ok,
    status: res.status,
    // The browser dropped this subscription; stop sending to it.
    gone: res.status === 404 || res.status === 410,
    body: ok ? undefined : await res.text().catch(() => undefined),
  };
}
