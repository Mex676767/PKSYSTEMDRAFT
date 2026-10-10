import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();

router.get("/activity-history/me", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const [logins, voiceSessions] = await Promise.all([
      pool.query(
        `select created_at::text as id, created_at as started_at, last_used_at as last_heartbeat_at,
                coalesce(revoked_at, case when expires_at <= now() then expires_at else null end) as ended_at
           from public.api_sessions where user_id = $1 order by created_at desc limit 20`,
        [req.sessionUser!.id],
      ),
      pool.query(
        `select id, channel_id, joined_at, left_at from public.voice_sessions
          where user_id = $1 order by joined_at desc limit 20`,
        [req.sessionUser!.id],
      ),
    ]);
    res.json({ logins: logins.rows, voiceSessions: voiceSessions.rows });
  } catch (error) { next(error); }
});

export default router;
