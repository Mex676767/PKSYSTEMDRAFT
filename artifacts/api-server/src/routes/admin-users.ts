import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requirePermission, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const manageUsers = [requireSession, requireApprovedSession, assertAllowedBrowserOrigin, requirePermission("manage_users")];
const adminOnly = [requireSession, requireApprovedSession, assertAllowedBrowserOrigin];
const isAdmin = (req: Request) => Boolean(req.sessionUser?.is_admin);

router.get("/admin/profiles", requireSession, requireApprovedSession, requirePermission("manage_users"), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select p.id, p.email, p.username, p.points, p.department, p.role, p.is_admin,
              p.permissions, p.is_deleted, p.is_hidden, p.birthday,
              (a.approved_at is not null) as is_approved, a.approved_at
         from public.profiles p left join public.account_approvals a on a.user_id = p.id
        order by p.username nulls last, p.email`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.patch("/admin/profiles/:id/username", ...manageUsers, async (req, res, next) => {
  const username = req.body?.username;
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) { res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, or underscore only." }); return; }
  try {
    const result = await pool.query("update public.profiles set username = $2 where id = $1 returning id", [req.params.id, username]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") { res.status(409).json({ error: "That username is already taken. Try another." }); return; }
    next(error);
  }
});

router.post("/admin/profiles/:id/approve", ...adminOnly, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const target = await client.query("select id from public.profiles where id = $1 and is_deleted = false for update", [req.params.id]);
      if (!target.rowCount) { await client.query("rollback"); res.status(404).json({ error: "User not found or deactivated." }); return; }
      await client.query(
        `insert into public.account_approvals (user_id, approved_at, approved_by) values ($1, now(), $2)
         on conflict (user_id) do update set approved_at = coalesce(public.account_approvals.approved_at, excluded.approved_at),
           approved_by = case when public.account_approvals.approved_at is null then excluded.approved_by else public.account_approvals.approved_by end`,
        [req.params.id, req.sessionUser!.id],
      );
      await client.query("commit");
      res.status(204).end();
    } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
    finally { client.release(); }
  } catch (error) { next(error); }
});

router.put("/admin/profiles/:id/hidden", ...adminOnly, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  if (typeof req.body?.hidden !== "boolean") { res.status(400).json({ error: "Hidden must be true or false." }); return; }
  try {
    const result = await pool.query("update public.profiles set is_hidden = $2 where id = $1", [req.params.id, req.body.hidden]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.put("/admin/profiles/:id/admin", ...adminOnly, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  if (typeof req.body?.value !== "boolean") { res.status(400).json({ error: "Admin must be true or false." }); return; }
  try {
    const result = await pool.query("update public.profiles set is_admin = $2 where id = $1", [req.params.id, req.body.value]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.put("/admin/profiles/:id/permissions", ...adminOnly, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  const permissions = req.body?.permissions;
  if (!Array.isArray(permissions) || permissions.length > 100 || permissions.some((permission: unknown) => typeof permission !== "string" || permission.length > 80)) { res.status(400).json({ error: "Permissions are invalid." }); return; }
  try {
    const result = await pool.query("update public.profiles set permissions = $2::text[] where id = $1", [req.params.id, [...new Set(permissions)]]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/admin/profiles/:id/points", ...manageUsers, async (req, res, next) => {
  const { amount, reason } = req.body ?? {};
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000 || (reason !== undefined && reason !== null && (typeof reason !== "string" || reason.length > 200))) { res.status(400).json({ error: "Point adjustment is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!(await client.query("select 1 from public.profiles where id = $1", [req.params.id])).rowCount) { await client.query("rollback"); res.status(404).json({ error: "User not found." }); return; }
    await client.query("select set_config('app.points_allowed', 'on', true)");
    await client.query("insert into public.point_transactions (user_id, amount, reason) values ($1, $2, $3)", [req.params.id, amount, typeof reason === "string" && reason.trim() ? reason.trim() : "Admin adjustment"]);
    await client.query("select set_config('app.points_allowed', 'off', true)");
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.put("/admin/profiles/:id/active", ...manageUsers, async (req, res, next) => {
  const active = req.body?.active;
  if (typeof active !== "boolean") { res.status(400).json({ error: "Active must be true or false." }); return; }
  if (req.params.id === req.sessionUser!.id && !active) { res.status(400).json({ error: "Use account deletion to deactivate your own account." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await client.query<{ is_admin: boolean }>("select is_admin from public.profiles where id = $1 for update", [req.params.id]);
    if (!target.rowCount) { await client.query("rollback"); res.status(404).json({ error: "User not found." }); return; }
    if (!active && target.rows[0].is_admin && !isAdmin(req)) { await client.query("rollback"); res.status(403).json({ error: "Only an admin can deactivate another admin." }); return; }
    await client.query("update public.profiles set is_deleted = $2 where id = $1", [req.params.id, !active]);
    if (!active) await client.query("update public.api_sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [req.params.id]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/account", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update public.profiles set is_deleted = true where id = $1", [req.sessionUser!.id]);
    await client.query("update public.api_sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [req.sessionUser!.id]);
    await client.query("commit");
    res.clearCookie("eh_session", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", path: "/api" });
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
