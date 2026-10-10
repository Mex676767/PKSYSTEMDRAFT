import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";
import { runtimeConfig } from "../lib/runtime-config";

const SESSION_COOKIE = "eh_session";
const SESSION_LIFETIME_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  username: string | null;
  points: number;
  badges: string[];
  current_streak: number;
  longest_streak: number;
  active_title: string | null;
  unlocked_titles: string[];
  active_accessory: string | null;
  unlocked_accessories: string[];
  role: string | null;
  department: string | null;
  avatar_url: string | null;
  birthday: string | null;
  unlocked_borders: string[];
  active_border: string | null;
  is_admin: boolean;
  permissions: string[];
  is_approved: boolean;
  is_deleted: boolean;
  has_email_identity: boolean;
  has_google_identity: boolean;
};

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionUser;
    }
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length < 40 || token.length > 128) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const result = await pool.query<SessionUser>(
      `select p.id, p.email, p.username, p.points, p.badges, p.current_streak, p.longest_streak,
              p.active_title, p.unlocked_titles, p.active_accessory, p.unlocked_accessories,
              p.role, p.department, p.avatar_url, p.birthday, p.unlocked_borders, p.active_border,
              p.is_admin, p.permissions, p.is_deleted,
              (a.approved_at is not null) as is_approved,
              exists(select 1 from public.api_password_credentials c where c.user_id = p.id) as has_email_identity,
              exists(select 1 from public.api_oauth_identities i where i.user_id = p.id and i.provider = 'google') as has_google_identity
         from public.api_sessions s
         join public.profiles p on p.id = s.user_id
         left join public.account_approvals a on a.user_id = p.id
        where s.token_hash = $1
          and s.revoked_at is null
          and s.expires_at > now()
          and p.is_deleted = false
        limit 1`,
      [hashToken(token)],
    );
    const user = result.rows[0];
    if (!user) {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
      res.status(401).json({ error: "Session is invalid or account access is not approved." });
      return;
    }

    user.permissions ??= [];
    user.badges ??= [];
    user.unlocked_titles ??= [];
    user.unlocked_accessories ??= [];
    user.unlocked_borders ??= [];
    user.is_approved = Boolean(user.is_approved);
    req.sessionUser = user;
    void pool.query(
      "update public.api_sessions set last_used_at = now() where token_hash = $1",
      [hashToken(token)],
    ).catch(() => undefined);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireApprovedSession(req: Request, res: Response, next: NextFunction) {
  if (!req.sessionUser) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!req.sessionUser.is_approved) {
    res.status(403).json({ error: "Your account is awaiting approval." });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.sessionUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!user.is_admin && !user.permissions.includes(permission)) {
      res.status(403).json({ error: "You do not have permission to manage Hall of Fame awards." });
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.sessionUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!user.is_admin && !permissions.some((permission) => user.permissions.includes(permission))) {
      res.status(403).json({ error: "You do not have permission to view Hall of Fame audit history." });
      return;
    }
    next();
  };
}

export async function issueSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into public.api_sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + ($3 * interval '1 day'))`,
    [hashToken(token), userId, SESSION_LIFETIME_DAYS],
  );
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
  });
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token.length <= 128) {
    await pool.query(
      "update public.api_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null",
      [hashToken(token)],
    );
  }
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/api",
  };
}

export function assertAllowedBrowserOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && runtimeConfig.allowedOrigins.has(origin)) {
    next();
    return;
  }
  res.status(403).json({ error: "Request origin is not allowed." });
}
