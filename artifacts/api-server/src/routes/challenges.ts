import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.get("/challenges", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    res.json((await pool.query(`select c.*,jsonb_build_object('username',a.username,'role',a.role,'avatar_url',a.avatar_url,'active_border',a.active_border,'active_accessory',a.active_accessory) as creator,
      jsonb_build_object('username',b.username,'role',b.role,'avatar_url',b.avatar_url,'active_border',b.active_border,'active_accessory',b.active_accessory) as opponent
      from public.challenges c join public.profiles a on a.id=c.creator_id join public.profiles b on b.id=c.opponent_id
      where c.pk_version=0 order by c.created_at desc`)).rows);
  } catch (error) { next(error); }
});

router.patch("/challenges/:id/respond", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { accept } = req.body ?? {};
  if (!isUuid(id) || typeof accept !== "boolean") { res.status(400).json({ error: "Challenge response is invalid." }); return; }
  try {
    const result = await pool.query("update public.challenges set status=case when $3 then 'active' else 'declined' end,starts_at=case when $3 then now() else starts_at end where id=$1 and pk_version=0 and opponent_id=$2 and status='pending' returning id", [id, req.sessionUser!.id, accept]);
    if (!result.rowCount) { res.status(404).json({ error: "Challenge not found or cannot be responded to." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/challenges/:id/cancel", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Challenge id is invalid." }); return; }
  try {
    const result = await pool.query("update public.challenges set status='declined' where id=$1 and pk_version=0 and status='pending' and (creator_id=$2 or opponent_id=$2) returning id", [id, req.sessionUser!.id]);
    if (!result.rowCount) { res.status(404).json({ error: "Pending challenge not found or cannot be cancelled." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.patch("/challenges/:id/score", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { score } = req.body ?? {};
  if (!isUuid(id) || !Number.isInteger(score) || score < 0 || score > 1000000) { res.status(400).json({ error: "Challenge score is invalid." }); return; }
  try {
    const result = await pool.query(`update public.challenges set
      score_creator=case when creator_id=$2 then $3 else score_creator end,
      score_opponent=case when opponent_id=$2 then $3 else score_opponent end
      where id=$1 and pk_version=0 and status='active' and (creator_id=$2 or opponent_id=$2) returning id`, [id, req.sessionUser!.id, score]);
    if (!result.rowCount) { res.status(404).json({ error: "Active challenge not found or cannot be updated." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/challenges/:id/complete", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Challenge id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ creator_id: string; opponent_id: string; score_creator: number; score_opponent: number }>("select creator_id,opponent_id,score_creator,score_opponent from public.challenges where id=$1 and pk_version=0 and status='active' for update", [id]);
    if (!result.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Active challenge not found." }); return; }
    const challenge = result.rows[0];
    if (![challenge.creator_id, challenge.opponent_id].includes(req.sessionUser!.id)) { await client.query("rollback"); res.status(403).json({ error: "You are not a participant in this challenge." }); return; }
    const winnerId = challenge.score_creator > challenge.score_opponent ? challenge.creator_id : challenge.score_opponent > challenge.score_creator ? challenge.opponent_id : null;
    await client.query("update public.challenges set status='completed',winner_id=$2 where id=$1", [id, winnerId]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/challenges/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Challenge id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.challenges where id=$1 and pk_version=0 and status in ('declined','completed') and (creator_id=$2 or $3=true)", [id, req.sessionUser!.id, req.sessionUser!.is_admin]);
    if (!result.rowCount) { res.status(404).json({ error: "Finished challenge not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
