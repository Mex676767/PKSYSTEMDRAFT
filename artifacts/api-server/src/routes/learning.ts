import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const PERSON = "jsonb_build_object('username',%1$s.username,'avatar_url',%1$s.avatar_url,'active_border',%1$s.active_border,'active_accessory',%1$s.active_accessory,'department',%1$s.department)";
const hasLearningPermission = (user: NonNullable<Express.Request["sessionUser"]>) => user.is_admin || user.permissions.includes("manage_learning");

router.get("/learning/resources", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select r.*,${PERSON.replaceAll("%1$s", "p")} as author from public.learning_resources r join public.profiles p on p.id = r.created_by order by r.created_at desc`)).rows); }
  catch (error) { next(error); }
});

router.post("/learning/resources", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { title, description = "", category = "General", url } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140 || typeof description !== "string" || description.length > 2000 || typeof category !== "string" || category.trim().length < 2 || category.trim().length > 60 || (url != null && (typeof url !== "string" || url.length > 1000))) { res.status(400).json({ error: "Learning resource is invalid." }); return; }
  if (!hasLearningPermission(req.sessionUser!)) { res.status(403).json({ error: "You cannot manage learning resources." }); return; }
  try {
    const result = await pool.query("insert into public.learning_resources (title,description,category,url,created_by) values ($1,$2,$3,$4,$5) returning id", [title.trim(), description.trim(), category.trim(), typeof url === "string" ? url.trim() || null : null, req.sessionUser!.id]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { next(error); }
});

router.delete("/learning/resources/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Resource id is invalid." }); return; }
  if (!hasLearningPermission(req.sessionUser!)) { res.status(403).json({ error: "You cannot manage learning resources." }); return; }
  try { const result = await pool.query("delete from public.learning_resources where id = $1", [id]); if (!result.rowCount) { res.status(404).json({ error: "Resource not found." }); return; } res.status(204).end(); }
  catch (error) { next(error); }
});

router.get("/learning/requests", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    res.json((await pool.query(`select r.*,
      ${PERSON.replaceAll("%1$s", "requester")} as requester,
      case when reviewer.id is null then null else ${PERSON.replaceAll("%1$s", "reviewer")} end as reviewer
      from public.learning_requests r join public.profiles requester on requester.id = r.user_id
      left join public.profiles reviewer on reviewer.id = r.reviewed_by order by r.created_at desc`)).rows);
  } catch (error) { next(error); }
});

router.post("/learning/requests", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { course_name: courseName, course_url: courseUrl, reason, benefit, estimated_cost: cost } = req.body ?? {};
  if (typeof courseName !== "string" || courseName.trim().length < 2 || courseName.trim().length > 160 || (courseUrl != null && (typeof courseUrl !== "string" || courseUrl.length > 1000)) || typeof reason !== "string" || reason.trim().length < 2 || reason.length > 2000 || typeof benefit !== "string" || benefit.trim().length < 2 || benefit.length > 2000 || (cost != null && (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0))) { res.status(400).json({ error: "Learning request is invalid." }); return; }
  try {
    const result = await pool.query("insert into public.learning_requests (user_id,course_name,course_url,reason,benefit,estimated_cost) values ($1,$2,$3,$4,$5,$6) returning id", [req.sessionUser!.id, courseName.trim(), typeof courseUrl === "string" ? courseUrl.trim() || null : null, reason.trim(), benefit.trim(), cost ?? null]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { next(error); }
});

router.patch("/learning/requests/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, review_note: note } = req.body ?? {};
  if (!isUuid(id) || (status !== "sponsored" && status !== "declined") || (note != null && (typeof note !== "string" || note.length > 1000))) { res.status(400).json({ error: "Review details are invalid." }); return; }
  if (!hasLearningPermission(req.sessionUser!)) { res.status(403).json({ error: "You cannot review learning requests." }); return; }
  try {
    const result = await pool.query("update public.learning_requests set status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now() where id=$1 returning id", [id, status, typeof note === "string" ? note.trim() || null : null, req.sessionUser!.id]);
    if (!result.rowCount) { res.status(404).json({ error: "Learning request not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/learning/requests/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Request id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.learning_requests where id=$1 and ((user_id=$2 and status='pending') or $3=true)", [id, req.sessionUser!.id, hasLearningPermission(req.sessionUser!)]);
    if (!result.rowCount) { res.status(404).json({ error: "Learning request not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get("/learning/shares", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select s.*,${PERSON.replaceAll("%1$s", "p")} as author from public.learning_shares s join public.profiles p on p.id = s.user_id order by s.created_at desc`)).rows); }
  catch (error) { next(error); }
});

router.post("/learning/shares", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { title, learned, benefit, resource_url: resourceUrl } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 160 || typeof learned !== "string" || learned.trim().length < 2 || learned.length > 3000 || typeof benefit !== "string" || benefit.trim().length < 2 || benefit.length > 2000 || (resourceUrl != null && (typeof resourceUrl !== "string" || resourceUrl.length > 1000))) { res.status(400).json({ error: "Learning share is invalid." }); return; }
  try { const result = await pool.query("insert into public.learning_shares (user_id,title,learned,benefit,resource_url) values ($1,$2,$3,$4,$5) returning id", [req.sessionUser!.id, title.trim(), learned.trim(), benefit.trim(), typeof resourceUrl === "string" ? resourceUrl.trim() || null : null]); res.status(201).json({ id: result.rows[0].id }); }
  catch (error) { next(error); }
});

router.delete("/learning/shares/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Share id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.learning_shares where id=$1 and (user_id=$2 or $3=true)", [id, req.sessionUser!.id, hasLearningPermission(req.sessionUser!)]);
    if (!result.rowCount) { res.status(404).json({ error: "Learning share not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
