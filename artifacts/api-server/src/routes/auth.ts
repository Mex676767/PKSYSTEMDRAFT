import { createHash, randomBytes } from "node:crypto";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, issueSession, requireApprovedSession, requireSession, revokeSession } from "../middleware/session-auth";
import { hashPassword, isValidNewPassword, verifyPassword } from "../lib/passwords";
import { runtimeConfig } from "../lib/runtime-config";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const authWindows = new Map<string, { count: number; resetsAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
const OAUTH_COOKIE_MAX_AGE = 10 * 60 * 1000;

function enforceRateLimit(req: Request, action: string, limit: number): boolean {
  const now = Date.now();
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const key = createHash("sha256").update(`${action}:${req.ip ?? ""}:${email}`).digest("hex");
  for (const [savedKey, window] of authWindows) if (window.resetsAt <= now) authWindows.delete(savedKey);
  const window = authWindows.get(key);
  if (!window || window.resetsAt <= now) {
    authWindows.set(key, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return true;
  }
  window.count += 1;
  return window.count <= limit;
}

function safeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyLoginPassword(password: string, encoded: string): Promise<boolean> {
  if (/^\$2[aby]\$\d\d\$/.test(encoded)) {
    const result = await pool.query<{ valid: boolean }>(
      "select crypt($1, $2) = $2 as valid",
      [password, encoded],
    );
    return Boolean(result.rows[0]?.valid);
  }
  return verifyPassword(password, encoded);
}

function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_CALLBACK_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

function clearOAuthCookies(res: import("express").Response) {
  const { maxAge: _maxAge, ...options } = oauthCookieOptions();
  for (const name of ["eh_oauth_state", "eh_oauth_verifier", "eh_oauth_return"]) res.clearCookie(name, options);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function sendResetEmail(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Password recovery email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your Employee Hub password",
      html: `<p>A password reset was requested for your Employee Hub account.</p><p><a href="${url}">Set a new password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider rejected a password recovery email (${response.status}).`);
}

router.get("/auth/me", requireSession, (req, res) => {
  const { has_email_identity, has_google_identity, ...user } = req.sessionUser!;
  const identities = [
    ...(has_email_identity ? [{ provider: "email" }] : []),
    ...(has_google_identity ? [{ provider: "google" }] : []),
  ];
  res.setHeader("Cache-Control", "no-store");
  res.json({ tenant: runtimeConfig.tenant, user: { ...user, identities } });
});

router.put("/auth/username", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const username = req.body?.username;
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, or underscore only." });
    return;
  }
  try {
    const result = await pool.query(
      "update public.profiles set username = $2 where id = $1 returning username",
      [req.sessionUser!.id, username],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Account not found." }); return; }
    res.json({ username });
  } catch (error) {
    if (isObject(error) && error.code === "23505") {
      res.status(409).json({ error: "That username is already taken. Try another." });
      return;
    }
    next(error);
  }
});

router.post("/auth/daily-login", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select public.award_title($1, 'newcomer')", [req.sessionUser!.id]);
    const updated = await client.query<{ current_streak: number }>(
      `update public.profiles
          set current_streak = case when last_login_date = current_date - 1 then current_streak + 1 else 1 end,
              longest_streak = greatest(longest_streak, case when last_login_date = current_date - 1 then current_streak + 1 else 1 end),
              last_login_date = current_date
        where id = $1 and last_login_date is distinct from current_date
        returning current_streak`,
      [req.sessionUser!.id],
    );
    if (updated.rows[0]?.current_streak >= 3) await client.query("select public.award_title($1, 'streak_starter')", [req.sessionUser!.id]);
    if (updated.rows[0]?.current_streak >= 7) await client.query("select public.award_title($1, 'streak_master')", [req.sessionUser!.id]);
    await client.query("commit");
    res.json({ claimed: Boolean(updated.rowCount) });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    next(error);
  } finally { client.release(); }
});

router.post("/auth/password/login", assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!enforceRateLimit(req, "login", 8)) { res.status(429).json({ error: "Too many attempts. Please wait and try again." }); return; }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;
  if (!email || email.length > 254 || typeof password !== "string" || password.length > 1024) {
    res.status(400).json({ error: "Email or password is invalid." });
    return;
  }
  try {
    const result = await pool.query<{
      id: string; is_deleted: boolean; password_hash: string | null; is_approved: boolean;
    }>(
      `select p.id, p.is_deleted, c.password_hash, (a.approved_at is not null) as is_approved
         from public.profiles p
         left join public.api_password_credentials c on c.user_id = p.id
         left join public.account_approvals a on a.user_id = p.id
        where lower(p.email) = $1 limit 1`, [email],
    );
    const account = result.rows[0];
    const valid = account?.password_hash
      ? await verifyLoginPassword(password, account.password_hash)
      : (await hashPassword(password), false);
    if (!account || !valid || account.is_deleted) {
      res.status(401).json({ error: "Email or password is incorrect. You may need to reset your password." });
      return;
    }
    if (account.password_hash && /^\$2[aby]\$\d\d\$/.test(account.password_hash)) {
      const upgradedHash = await hashPassword(password);
      await pool.query(
        `update public.api_password_credentials
            set password_hash = $2, password_updated_at = now()
          where user_id = $1 and password_hash = $3`,
        [account.id, upgradedHash, account.password_hash],
      );
    }
    await issueSession(res, account.id);
    res.json({ authenticated: true, is_approved: Boolean(account.is_approved) });
  } catch (error) { next(error); }
});

router.post("/auth/password/forgot", assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!enforceRateLimit(req, "recovery", 3)) { res.status(429).json({ error: "Too many requests. Please wait and try again." }); return; }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    res.status(503).json({ error: "Password recovery is temporarily unavailable." });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254) { res.status(400).json({ error: "A valid email address is required." }); return; }
  const origin = req.get("origin")!;
  try {
    const profile = await pool.query<{ id: string; email: string }>(
      "select id, email from public.profiles where lower(email) = $1 and is_deleted = false limit 1", [email],
    );
    if (profile.rows[0]) {
      const token = randomBytes(32).toString("base64url");
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "update public.api_password_reset_tokens set consumed_at = now() where user_id = $1 and consumed_at is null", [profile.rows[0].id],
        );
        await client.query(
          `insert into public.api_password_reset_tokens (token_hash, user_id, expires_at)
           values ($1, $2, now() + interval '30 minutes')`, [hashToken(token), profile.rows[0].id],
        );
        await client.query("commit");
      } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
      finally { client.release(); }
      const resetUrl = new URL("/reset-password", origin);
      resetUrl.searchParams.set("token", token);
      try {
        await sendResetEmail(profile.rows[0].email, resetUrl.toString());
      } catch (error) {
        logger.warn({ err: error }, "Password reset email delivery failed");
        await pool.query(
          "update public.api_password_reset_tokens set consumed_at = now() where token_hash = $1 and consumed_at is null",
          [hashToken(token)],
        ).catch(() => undefined);
      }
    }
    res.json({ message: "If the account exists, password reset instructions have been sent." });
  } catch (error) { next(error); }
});

router.post("/auth/password/reset", assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!enforceRateLimit(req, "reset", 8)) { res.status(429).json({ error: "Too many requests. Please wait and try again." }); return; }
  const token = req.body?.token;
  const password = req.body?.password;
  if (!safeString(token) || token.length > 128 || !isValidNewPassword(password)) {
    res.status(400).json({ error: "The reset link or new password is invalid. Use at least 12 characters." });
    return;
  }
  try {
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("begin");
      const reset = await client.query<{ user_id: string }>(
        `select user_id from public.api_password_reset_tokens
          where token_hash = $1 and consumed_at is null and expires_at > now() for update`, [hashToken(token)],
      );
      if (!reset.rowCount) { await client.query("rollback"); res.status(400).json({ error: "The reset link is invalid or expired." }); return; }
      const userId = reset.rows[0].user_id;
      await client.query(
        `insert into public.api_password_credentials (user_id, password_hash, password_updated_at)
         values ($1, $2, now()) on conflict (user_id) do update set password_hash = excluded.password_hash, password_updated_at = now()`,
        [userId, passwordHash],
      );
      await client.query("update public.api_password_reset_tokens set consumed_at = now() where user_id = $1 and consumed_at is null", [userId]);
      await client.query("update public.api_sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]);
      await client.query("commit");
      res.status(204).end();
    } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch (error) { next(error); }
});

router.post("/auth/password/change", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!enforceRateLimit(req, "change", 8)) { res.status(429).json({ error: "Too many attempts. Please wait and try again." }); return; }
  const currentPassword = req.body?.current_password;
  const newPassword = req.body?.new_password;
  if (typeof currentPassword !== "string" || !isValidNewPassword(newPassword)) {
    res.status(400).json({ error: "Current password and a new password of at least 12 characters are required." });
    return;
  }
  try {
    const current = await pool.query<{ password_hash: string }>(
      "select password_hash from public.api_password_credentials where user_id = $1", [req.sessionUser!.id],
    );
    if (!current.rows[0] || !(await verifyPassword(currentPassword, current.rows[0].password_hash))) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }
    const nextHash = await hashPassword(newPassword);
    const currentToken = req.cookies?.eh_session;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "update public.api_password_credentials set password_hash = $2, password_updated_at = now() where user_id = $1",
        [req.sessionUser!.id, nextHash],
      );
      if (typeof currentToken === "string") {
        await client.query(
          "update public.api_sessions set revoked_at = now() where user_id = $1 and revoked_at is null and token_hash <> $2",
          [req.sessionUser!.id, hashToken(currentToken)],
        );
      }
      await client.query("commit");
    } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
    finally { client.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/auth/google/start", assertAllowedBrowserOrigin, (req, res) => {
  if (!enforceRateLimit(req, "google", 8)) { res.status(429).json({ error: "Too many attempts. Please wait and try again." }); return; }
  const googleOAuth = runtimeConfig.googleOAuth;
  if (!googleOAuth) {
    res.status(503).json({ error: "Google sign-in is not configured for this tenant." });
    return;
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const origin = req.get("origin")!;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: googleOAuth.clientId,
    redirect_uri: googleOAuth.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  res.cookie("eh_oauth_state", state, oauthCookieOptions());
  res.cookie("eh_oauth_verifier", verifier, oauthCookieOptions());
  res.cookie("eh_oauth_return", origin, oauthCookieOptions());
  res.json({ authorization_url: authorizationUrl.toString() });
});

router.get("/auth/google/callback", async (req, res, next) => {
  const state = req.cookies?.eh_oauth_state;
  const verifier = req.cookies?.eh_oauth_verifier;
  const returnOrigin = req.cookies?.eh_oauth_return;
  const callbackState = req.query.state;
  if (typeof state !== "string" || typeof verifier !== "string" || typeof returnOrigin !== "string" || typeof callbackState !== "string" || !runtimeConfig.allowedOrigins.has(returnOrigin) || state.length !== callbackState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(callbackState))) {
    clearOAuthCookies(res);
    res.status(400).send("Google sign-in could not be verified. Return to the Hub and try again.");
    return;
  }
  clearOAuthCookies(res);
  const returnUrl = new URL("/", returnOrigin);
  try {
    if (typeof req.query.error === "string" || typeof req.query.code !== "string") {
      returnUrl.searchParams.set("auth_error", "google");
      res.redirect(returnUrl.toString());
      return;
    }
    const googleOAuth = runtimeConfig.googleOAuth;
    if (!googleOAuth) throw new Error("Google sign-in is not configured.");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: googleOAuth.clientId,
        client_secret: googleOAuth.clientSecret,
        redirect_uri: googleOAuth.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    const tokenBody: unknown = await tokenResponse.json();
    if (!tokenResponse.ok || !isObject(tokenBody) || typeof tokenBody.access_token !== "string") throw new Error("Google authorization failed.");

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    const googleUser: unknown = await userResponse.json();
    if (!userResponse.ok || !isObject(googleUser) || typeof googleUser.sub !== "string" || typeof googleUser.email !== "string" || googleUser.email_verified !== true) {
      throw new Error("Google did not return a verified email address.");
    }

    const client = await pool.connect();
    let userId: string;
    try {
      await client.query("begin");
      const linked = await client.query<{ user_id: string }>(
        "select user_id from public.api_oauth_identities where provider = 'google' and provider_subject = $1 for update",
        [googleUser.sub],
      );
      if (linked.rows[0]) {
        userId = linked.rows[0].user_id;
      } else {
        const profiles = await client.query<{ id: string; is_deleted: boolean }>(
          "select id, is_deleted from public.profiles where lower(email) = lower($1) order by id limit 2 for update",
          [googleUser.email],
        );
        if (profiles.rows.length > 1) throw new Error("More than one account matches this verified Google email.");
        if (profiles.rows[0]?.is_deleted) throw new Error("This account is deactivated.");
        userId = profiles.rows[0]?.id ?? randomUUID();
        if (!profiles.rows[0]) {
          await client.query("insert into public.profiles (id, email) values ($1, $2)", [userId, googleUser.email.toLowerCase()]);
        }
        await client.query(
          "insert into public.account_approvals (user_id) values ($1) on conflict (user_id) do nothing", [userId],
        );
        const inserted = await client.query<{ user_id: string }>(
          `insert into public.api_oauth_identities (provider, provider_subject, user_id)
           values ('google', $1, $2) on conflict (provider, provider_subject) do nothing returning user_id`,
          [googleUser.sub, userId],
        );
        if (!inserted.rows[0]) {
          const winner = await client.query<{ user_id: string }>(
            "select user_id from public.api_oauth_identities where provider = 'google' and provider_subject = $1", [googleUser.sub],
          );
          if (winner.rows[0]?.user_id !== userId) throw new Error("Google identity was linked to a different account.");
        }
      }
      const profile = await client.query<{ is_deleted: boolean }>("select is_deleted from public.profiles where id = $1", [userId]);
      if (!profile.rows[0] || profile.rows[0].is_deleted) throw new Error("This account is deactivated.");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally { client.release(); }

    await issueSession(res, userId);
    res.redirect(returnUrl.toString());
  } catch (error) {
    logger.warn({ err: error }, "Google sign-in failed");
    returnUrl.searchParams.set("auth_error", "google");
    res.redirect(returnUrl.toString());
  }
});

router.post("/auth/logout", assertAllowedBrowserOrigin, async (req, res, next) => {
  try {
    await revokeSession(req, res);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
