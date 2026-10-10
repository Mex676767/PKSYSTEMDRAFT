import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
function validBirthday(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}

router.get("/birthdays", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select id, username, department, role, birthday, avatar_url, active_border, active_accessory
         from public.profiles where birthday is not null and is_deleted = false and is_hidden = false`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.put("/profile/birthday", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const birthday = req.body?.birthday;
  if (!validBirthday(birthday)) { res.status(400).json({ error: "Birthday must be a valid date that has already occurred." }); return; }
  try {
    const result = await pool.query("update public.profiles set birthday = $2::date where id = $1 and birthday is null", [req.sessionUser!.id, birthday]);
    if (!result.rowCount) { res.status(409).json({ error: "Your birthday is already set. Ask an admin to change it." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.put("/admin/profiles/:id/birthday", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!req.sessionUser!.is_admin) { res.status(403).json({ error: "Admin access is required." }); return; }
  const birthday = req.body?.birthday;
  if (!validBirthday(birthday)) { res.status(400).json({ error: "Birthday must be a valid date that has already occurred." }); return; }
  try {
    const result = await pool.query("update public.profiles set birthday = $2::date where id = $1", [req.params.id, birthday]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
