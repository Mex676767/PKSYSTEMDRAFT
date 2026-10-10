import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const GOAL_SELECT = `g.id,g.owner_id,g.title,g.description,g.term,g.category,g.accountability,g.action_plan,g.target_date,g.progress,g.completed,g.created_at,
  jsonb_build_object('username',p.username,'role',p.role,'avatar_url',p.avatar_url,'active_border',p.active_border,'active_accessory',p.active_accessory) as owner`;
const UPDATE_SELECT = `u.id,u.goal_id,u.author_id,u.progress,u.note,u.created_at,
  jsonb_build_object('username',p.username,'avatar_url',p.avatar_url,'active_border',p.active_border,'active_accessory',p.active_accessory) as author`;
const validTerm = (value: unknown) => value === "short" || value === "mid" || value === "long";
const validCategory = (value: unknown) => value === "personal" || value === "career";

function validGoalFields(value: Record<string, unknown>, partial = false) {
  const textFields = ["title", "description", "accountability", "action_plan"] as const;
  if (!partial && (typeof value.title !== "string" || !value.title.trim())) return false;
  if (value.title !== undefined && (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 200)) return false;
  if (value.description !== undefined && value.description !== null && (typeof value.description !== "string" || value.description.length > 3000)) return false;
  for (const field of textFields.slice(2)) if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || value[field].length > 3000)) return false;
  if (value.term !== undefined && !validTerm(value.term)) return false;
  if (value.category !== undefined && !validCategory(value.category)) return false;
  if (value.progress !== undefined && (!Number.isInteger(value.progress) || (value.progress as number) < 0 || (value.progress as number) > 100)) return false;
  if (value.completed !== undefined && typeof value.completed !== "boolean") return false;
  if (value.target_date !== undefined && value.target_date !== null && (typeof value.target_date !== "string" || Number.isNaN(Date.parse(value.target_date)))) return false;
  return true;
}

router.get("/goals", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select ${GOAL_SELECT} from public.goals g join public.profiles p on p.id = g.owner_id order by g.created_at desc`)).rows); }
  catch (error) { next(error); }
});

router.get("/goals/mine", requireSession, requireApprovedSession, async (req, res, next) => {
  try { res.json((await pool.query(`select ${GOAL_SELECT} from public.goals g join public.profiles p on p.id = g.owner_id where g.owner_id = $1 order by g.created_at desc`, [req.sessionUser!.id])).rows); }
  catch (error) { next(error); }
});

router.get("/goals/mine/term-coverage", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const result = await pool.query<{ term: string }>("select distinct term from public.goals where owner_id = $1", [req.sessionUser!.id]);
    const present = new Set(result.rows.map((goal) => goal.term));
    const missing = (["short", "mid", "long"] as const).filter((term) => !present.has(term));
    res.json({ complete: missing.length === 0, missing });
  } catch (error) { next(error); }
});

router.post("/goals", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const body = req.body ?? {};
  if (!validGoalFields(body) || !validTerm(body.term) || !validCategory(body.category)) { res.status(400).json({ error: "Goal details are invalid." }); return; }
  try {
    const inserted = await pool.query("insert into public.goals (owner_id,title,description,term,category,accountability,action_plan,target_date) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id", [req.sessionUser!.id, body.title.trim(), body.description ?? null, body.term, body.category, body.accountability || null, body.action_plan || null, body.target_date ?? null]);
    const result = await pool.query(`select ${GOAL_SELECT} from public.goals g join public.profiles p on p.id = g.owner_id where g.id = $1`, [inserted.rows[0].id]);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.patch("/goals/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { id } = req.params;
  const body = req.body;
  if (!isUuid(id) || typeof body !== "object" || body === null || Array.isArray(body) || !validGoalFields(body, true)) { res.status(400).json({ error: "Goal details are invalid." }); return; }
  const fields = ["title", "description", "term", "category", "accountability", "action_plan", "target_date", "progress", "completed"] as const;
  const updates = fields.filter((field) => Object.hasOwn(body, field));
  if (!updates.length) { res.status(400).json({ error: "At least one goal field is required." }); return; }
  try {
    const existing = await pool.query<{ owner_id: string }>("select owner_id from public.goals where id = $1", [id]);
    if (!existing.rowCount) { res.status(404).json({ error: "Goal not found." }); return; }
    if (existing.rows[0].owner_id !== req.sessionUser!.id && !req.sessionUser!.is_admin) { res.status(403).json({ error: "Only the goal owner can update it." }); return; }
    const params: unknown[] = [id];
    const sets = updates.map((field, index) => { params.push(body[field]); return `${field} = $${index + 2}`; });
    await pool.query(`update public.goals set ${sets.join(", ")} where id = $1`, params);
    res.json((await pool.query(`select ${GOAL_SELECT} from public.goals g join public.profiles p on p.id = g.owner_id where g.id = $1`, [id])).rows[0]);
  } catch (error) { next(error); }
});

router.delete("/goals/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Goal id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.goals where id = $1 and (owner_id = $2 or $3 = true)", [req.params.id, req.sessionUser!.id, req.sessionUser!.is_admin]);
    if (!result.rowCount) { res.status(404).json({ error: "Goal not found or you cannot delete it." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get("/goals/:id/updates", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Goal id is invalid." }); return; }
  try { res.json((await pool.query(`select ${UPDATE_SELECT} from public.goal_updates u join public.profiles p on p.id = u.author_id where u.goal_id = $1 order by u.created_at desc`, [req.params.id])).rows); }
  catch (error) { next(error); }
});

router.get("/goals/:id/updates/stats", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Goal id is invalid." }); return; }
  try {
    const result = await pool.query("select count(*)::int as count, max(created_at) as last from public.goal_updates where goal_id = $1", [req.params.id]);
    res.json({ count: result.rows[0].count, last: result.rows[0].last });
  } catch (error) { next(error); }
});

router.post("/goals/:id/updates", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { progress, completed, note } = req.body ?? {};
  if (!isUuid(req.params.id) || !Number.isInteger(progress) || progress < 0 || progress > 100 || typeof completed !== "boolean" || typeof note !== "string" || note.length > 3000) { res.status(400).json({ error: "Progress update is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const goal = await client.query("select owner_id from public.goals where id = $1 for update", [req.params.id]);
    if (!goal.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Goal not found." }); return; }
    if (goal.rows[0].owner_id !== req.sessionUser!.id) { await client.query("rollback"); res.status(403).json({ error: "Only the goal owner can post progress." }); return; }
    await client.query("update public.goals set progress = $2, completed = $3 where id = $1", [req.params.id, progress, completed]);
    const inserted = await client.query("insert into public.goal_updates (goal_id, author_id, progress, note) values ($1,$2,$3,$4) returning id", [req.params.id, req.sessionUser!.id, progress, note.trim() || null]);
    const update = await client.query(`select ${UPDATE_SELECT} from public.goal_updates u join public.profiles p on p.id = u.author_id where u.id = $1`, [inserted.rows[0].id]);
    await client.query("commit");
    res.status(201).json(update.rows[0]);
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/goal-updates/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Update id is invalid." }); return; }
  try {
    const result = await pool.query(
      `delete from public.goal_updates u using public.goals g where u.id = $1 and g.id = u.goal_id and (u.author_id = $2 or $3 = true)`,
      [req.params.id, req.sessionUser!.id, req.sessionUser!.is_admin],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Progress update not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
