import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const MOODS = new Set(["Low", "Not great", "Okay", "Good", "Great"]);

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

router.get("/mood-checkins/me", requireSession, requireApprovedSession, async (req, res, next) => {
  const date = req.query.date;
  if (!validDate(date)) { res.status(400).json({ error: "A valid check-in date is required." }); return; }
  try {
    const result = await pool.query(
      `select user_id, checkin_date, mood
         from public.daily_mood_checkins where user_id = $1 and checkin_date = $2::date`,
      [req.sessionUser!.id, date],
    );
    res.json(result.rows[0] ?? null);
  } catch (error) { next(error); }
});

router.put("/mood-checkins/me", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { checkin_date: date, mood } = req.body ?? {};
  if (!validDate(date) || typeof mood !== "string" || !MOODS.has(mood)) {
    res.status(400).json({ error: "Mood or check-in date is invalid." });
    return;
  }
  try {
    const result = await pool.query(
      `insert into public.daily_mood_checkins (user_id, checkin_date, mood)
       values ($1, $2::date, $3)
       on conflict (user_id, checkin_date) do update set mood = excluded.mood
       returning user_id, checkin_date, mood, created_at`,
      [req.sessionUser!.id, date, mood],
    );
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.get("/admin/mood-checkins", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!req.sessionUser!.is_admin) { res.status(403).json({ error: "Admin access is required." }); return; }
  const date = req.query.date;
  if (!validDate(date)) { res.status(400).json({ error: "A valid check-in date is required." }); return; }
  try {
    const [checkIns, eligibleUsers] = await Promise.all([
      pool.query(
        `select c.user_id, c.checkin_date, c.mood, c.created_at, p.username, p.email
           from public.daily_mood_checkins c
           join public.profiles p on p.id = c.user_id
          where c.checkin_date = $1::date
          order by c.created_at desc, p.username asc`,
        [date],
      ),
      pool.query(
        `select count(*)::int as count from public.profiles p
          join public.account_approvals a on a.user_id = p.id
         where p.is_deleted = false`,
      ),
    ]);
    res.json({ checkins: checkIns.rows, eligible_users: eligibleUsers.rows[0]?.count ?? 0 });
  } catch (error) { next(error); }
});

export default router;
