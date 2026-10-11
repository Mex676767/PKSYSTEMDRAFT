import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();

router.get("/activity-history/:userId", requireSession, requireApprovedSession, async (req, res, next) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    res.status(400).json({ error: "User id is invalid." });
    return;
  }

  try {
    const [logins, voiceSessions] = await Promise.all([
      pool.query(
        `select created_at::text as id, created_at as started_at, last_used_at as last_heartbeat_at,
                coalesce(revoked_at, case when expires_at <= now() then expires_at else null end) as ended_at
           from public.api_sessions where user_id = $1 order by created_at desc limit 20`,
        [userId],
      ),
      pool.query(
        `select s.id, s.channel_id, s.joined_at,
                case
                  when s.left_at is not null then s.left_at
                  when p.last_seen_at > now() - interval '20 seconds' then null
                  else coalesce(p.last_seen_at, s.joined_at)
                end as left_at
           from public.voice_sessions s
           left join public.voice_presence p
             on p.user_id = s.user_id and p.channel_id = s.channel_id
          where s.user_id = $1
          order by s.joined_at desc limit 20`,
        [userId],
      ),
    ]);
    res.json({ logins: logins.rows, voiceSessions: voiceSessions.rows });
  } catch (error) { next(error); }
});

export default router;
