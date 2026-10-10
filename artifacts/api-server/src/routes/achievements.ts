import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const requireAdmin = (req: import("express").Request, res: import("express").Response) => {
  if (req.sessionUser!.is_admin) return true;
  res.status(403).json({ error: "Admin access is required." });
  return false;
};
const admin = [requireSession, requireApprovedSession, assertAllowedBrowserOrigin];

router.get("/achievements", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query("select key, label, description, builtin from public.achievements order by created_at, key");
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/admin/achievement-holders", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query("select id, username, avatar_url, unlocked_titles from public.profiles where username is not null order by username");
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.post("/admin/achievements", ...admin, async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  const { key, label, description } = req.body ?? {};
  if (typeof key !== "string" || !/^[a-z0-9_]{1,60}$/.test(key) || typeof label !== "string" || !label.trim() || label.trim().length > 40 || typeof description !== "string" || description.length > 3000) {
    res.status(400).json({ error: "Achievement details are invalid." }); return;
  }
  try {
    const result = await pool.query("insert into public.achievements (key, label, description, builtin) values ($1, $2, $3, false) returning key, label, description, builtin", [key, label.trim(), description.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.patch("/admin/achievements/:key", ...admin, async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  const { label, description } = req.body ?? {};
  if (typeof label !== "string" || !label.trim() || label.trim().length > 40 || typeof description !== "string" || description.length > 3000) {
    res.status(400).json({ error: "Achievement details are invalid." }); return;
  }
  try {
    const result = await pool.query("update public.achievements set label = $2, description = $3 where key = $1 returning key", [req.params.key, label.trim(), description.trim()]);
    if (!result.rowCount) { res.status(404).json({ error: "Achievement not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/admin/achievements/:key", ...admin, async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query("delete from public.achievements where key = $1 and builtin = false returning key", [req.params.key]);
    if (!result.rowCount) { res.status(404).json({ error: "Custom achievement not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.put("/admin/profiles/:id/achievements", ...admin, async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  const { key, has_it: hasIt } = req.body ?? {};
  if (typeof key !== "string" || typeof hasIt !== "boolean") { res.status(400).json({ error: "Achievement key and assignment are required." }); return; }
  try {
    const exists = await pool.query("select 1 from public.achievements where key = $1", [key]);
    if (!exists.rowCount) { res.status(404).json({ error: "Achievement not found." }); return; }
    if (hasIt) await pool.query("select public.award_title($1, $2)", [req.params.id, key]);
    else await pool.query("update public.profiles set unlocked_titles = array_remove(unlocked_titles, $2), active_title = case when active_title = $2 then null else active_title end where id = $1", [req.params.id, key]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
