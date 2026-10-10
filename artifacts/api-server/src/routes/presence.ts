import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.get("/presence", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select distinct on (p.user_id) p.user_id,p.path,p.activity
         from public.app_presence p join public.profiles u on u.id=p.user_id
        where p.last_seen_at > now() - interval '2 minutes' and u.is_deleted=false and u.is_hidden=false
        order by p.user_id,p.last_seen_at desc`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.put("/presence/me", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { client_id: clientId, path, activity } = req.body ?? {};
  if (!isUuid(clientId) || typeof path !== "string" || !path.startsWith("/") || path.length > 200 || typeof activity !== "string" || activity.length > 80) {
    res.status(400).json({ error: "Presence details are invalid." }); return;
  }
  try {
    await pool.query(
      `insert into public.app_presence (user_id,client_id,path,activity,last_seen_at) values ($1,$2,$3,$4,now())
       on conflict (user_id,client_id) do update set path=excluded.path,activity=excluded.activity,last_seen_at=now()` ,
      [req.sessionUser!.id, clientId, path, activity],
    );
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/presence/me/:clientId", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const clientId = Array.isArray(req.params.clientId) ? req.params.clientId[0] : req.params.clientId;
  if (!isUuid(clientId)) { res.status(400).json({ error: "Presence client id is invalid." }); return; }
  try {
    await pool.query("delete from public.app_presence where user_id=$1 and client_id=$2", [req.sessionUser!.id, clientId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
