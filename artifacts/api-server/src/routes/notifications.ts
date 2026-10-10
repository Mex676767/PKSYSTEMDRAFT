import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.get("/notifications", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const result = await pool.query(
      "select id,user_id,actor_id,type,target_type,target_id,message,read,created_at from public.notifications where user_id=$1 and type <> 'dm' order by created_at desc limit 50",
      [req.sessionUser!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.patch("/notifications/:id/read", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Notification id is invalid." }); return; }
  try {
    const result = await pool.query("update public.notifications set read=true where id=$1 and user_id=$2 returning id", [id, req.sessionUser!.id]);
    if (!result.rowCount) { res.status(404).json({ error: "Notification not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.patch("/notifications/read-all", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  try {
    await pool.query("update public.notifications set read=true where user_id=$1 and read=false", [req.sessionUser!.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
