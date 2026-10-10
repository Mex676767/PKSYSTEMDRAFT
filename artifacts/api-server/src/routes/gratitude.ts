import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const PERSON = (alias: string) => `jsonb_build_object('username',${alias}.username,'avatar_url',${alias}.avatar_url,'active_border',${alias}.active_border,'active_accessory',${alias}.active_accessory,'department',${alias}.department)`;
const SELECT = `g.id,g.sender_id,g.recipient_id,g.message,g.first_seen_at,g.created_at,${PERSON("s")} as sender,${PERSON("r")} as recipient`;

router.get("/gratitude", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select ${SELECT} from public.gratitude_letters g join public.profiles s on s.id=g.sender_id join public.profiles r on r.id=g.recipient_id order by g.created_at desc`)).rows); }
  catch (error) { next(error); }
});

router.get("/gratitude/unseen", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    res.json((await pool.query(`select ${SELECT} from public.gratitude_letters g join public.profiles s on s.id=g.sender_id join public.profiles r on r.id=g.recipient_id where g.recipient_id=$1 and g.first_seen_at is null order by g.created_at asc`, [req.sessionUser!.id])).rows);
  } catch (error) { next(error); }
});

router.post("/gratitude", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { recipient_id: recipientId, message } = req.body ?? {};
  if (!isUuid(recipientId) || typeof message !== "string" || message.trim().length < 2 || message.trim().length > 2000) { res.status(400).json({ error: "Gratitude message is invalid." }); return; }
  if (recipientId === req.sessionUser!.id) { res.status(400).json({ error: "You cannot send gratitude to yourself." }); return; }
  try {
    const result = await pool.query("insert into public.gratitude_letters (sender_id,recipient_id,message) values ($1,$2,$3) returning id", [req.sessionUser!.id, recipientId, message.trim()]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { next(error); }
});

router.patch("/gratitude/seen", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length > 100 || !ids.every(isUuid)) { res.status(400).json({ error: "Gratitude ids are invalid." }); return; }
  if (!ids.length) { res.status(204).end(); return; }
  try {
    await pool.query("update public.gratitude_letters set first_seen_at=now() where recipient_id=$1 and id=any($2::uuid[])", [req.sessionUser!.id, ids]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/gratitude/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Gratitude id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.gratitude_letters where id=$1 and (sender_id=$2 or $3=true)", [id, req.sessionUser!.id, req.sessionUser!.is_admin]);
    if (!result.rowCount) { res.status(404).json({ error: "Gratitude message not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
