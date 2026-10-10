import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.get("/points/history", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const result = await pool.query(
      "select id, amount, reason, created_at from public.point_transactions where user_id = $1 order by created_at desc limit 20",
      [req.sessionUser!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/points/giftable-profiles", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const result = await pool.query(
      `select id, username from public.profiles
        where id <> $1 and username is not null and is_deleted = false
        order by username`,
      [req.sessionUser!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.post("/points/gift", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { recipient_id: recipientId, amount, note } = req.body ?? {};
  if (!isUuid(recipientId) || !Number.isInteger(amount) || amount <= 0 || amount > 100000 || (note !== undefined && note !== null && (typeof note !== "string" || note.length > 200))) {
    res.status(400).json({ error: "Gift details are invalid." }); return;
  }
  if (recipientId === req.sessionUser!.id) { res.status(400).json({ error: "Cannot gift points to yourself." }); return; }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const profiles = await client.query<{ id: string; points: number }>(
      `select id, points from public.profiles where id = any($1::uuid[]) and is_deleted = false order by id for update`,
      [[req.sessionUser!.id, recipientId]],
    );
    const sender = profiles.rows.find((profile) => profile.id === req.sessionUser!.id);
    const recipient = profiles.rows.find((profile) => profile.id === recipientId);
    if (!sender || !recipient) { await client.query("rollback"); res.status(404).json({ error: "Recipient not found." }); return; }
    if (sender.points < amount) { await client.query("rollback"); res.status(400).json({ error: "Not enough points." }); return; }
    const cleanNote = typeof note === "string" ? note.trim() : "";
    const suffix = cleanNote ? `: ${cleanNote}` : "";
    await client.query("insert into public.point_transactions (user_id, amount, reason) values ($1, $2, $3), ($4, $5, $6)",
      [sender.id, -amount, `Gift sent${suffix}`, recipient.id, amount, `Gift received${suffix}`]);
    await client.query("update public.profiles set unlocked_titles = array_append(unlocked_titles, 'philanthropist') where id = $1 and not ('philanthropist' = any(unlocked_titles))", [sender.id]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
