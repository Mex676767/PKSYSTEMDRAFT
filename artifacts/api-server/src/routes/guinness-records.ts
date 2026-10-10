import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireAnyPermission, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const manage = [requireSession, requireApprovedSession, assertAllowedBrowserOrigin, requireAnyPermission("manage_hall_of_fame")];
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const RECORD_SELECT = `r.id, r.category_id, r.holder_id, r.achievement, r.record_date, r.is_current, r.created_at,
  case when p.id is null then null else jsonb_build_object('username',p.username,'avatar_url',p.avatar_url,'active_border',p.active_border,'active_accessory',p.active_accessory,'department',p.department) end as holder`;

router.get("/guinness/categories", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select id, name, description, icon, sort_order from public.hof_categories order by sort_order, created_at")).rows); }
  catch (error) { next(error); }
});

router.get("/guinness/records/current", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select ${RECORD_SELECT} from public.hof_records r left join public.profiles p on p.id = r.holder_id where r.is_current = true order by r.record_date desc`)).rows); }
  catch (error) { next(error); }
});

router.get("/guinness/records/history/:categoryId", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!isUuid(req.params.categoryId)) { res.status(400).json({ error: "Category id is invalid." }); return; }
  try { res.json((await pool.query(`select ${RECORD_SELECT} from public.hof_records r left join public.profiles p on p.id = r.holder_id where r.category_id = $1 order by r.created_at desc`, [req.params.categoryId])).rows); }
  catch (error) { next(error); }
});

router.get("/guinness/usernames", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select id, username from public.profiles where username is not null and is_deleted = false and is_hidden = false order by username")).rows); }
  catch (error) { next(error); }
});

router.post("/guinness/categories", ...manage, async (req, res, next) => {
  const { name, description, icon } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 || typeof description !== "string" || description.length > 1000 || typeof icon !== "string" || icon.length > 40) { res.status(400).json({ error: "Category details are invalid." }); return; }
  try {
    const result = await pool.query("insert into public.hof_categories (name, description, icon) values ($1, $2, $3) returning id, name, description, icon, sort_order", [name.trim(), description.trim(), icon]);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.post("/guinness/records", ...manage, async (req, res, next) => {
  const { category_id: categoryId, holder_id: holderId, achievement } = req.body ?? {};
  if (!isUuid(categoryId) || !isUuid(holderId) || typeof achievement !== "string" || !achievement.trim() || achievement.trim().length > 300) { res.status(400).json({ error: "Record details are invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!(await client.query("select 1 from public.hof_categories where id = $1 for update", [categoryId])).rowCount) { await client.query("rollback"); res.status(404).json({ error: "Category not found." }); return; }
    if (!(await client.query("select 1 from public.profiles where id = $1 and is_deleted = false", [holderId])).rowCount) { await client.query("rollback"); res.status(404).json({ error: "Holder not found." }); return; }
    await client.query("update public.hof_records set is_current = false where category_id = $1 and is_current = true", [categoryId]);
    const inserted = await client.query(
      `insert into public.hof_records (category_id, holder_id, achievement, is_current) values ($1, $2, $3, true)
       returning id, category_id, holder_id, achievement, record_date, is_current, created_at`,
      [categoryId, holderId, achievement.trim()],
    );
    const result = await client.query(`select ${RECORD_SELECT} from public.hof_records r left join public.profiles p on p.id = r.holder_id where r.id = $1`, [inserted.rows[0].id]);
    await client.query("commit");
    res.status(201).json(result.rows[0]);
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/guinness/records/:id", ...manage, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Record id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const row = await client.query(
      `select r.*, c.name as category_name, p.username as holder_name
         from public.hof_records r left join public.hof_categories c on c.id = r.category_id
         left join public.profiles p on p.id = r.holder_id where r.id = $1 for update of r`, [req.params.id],
    );
    if (!row.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Record no longer exists." }); return; }
    const record = row.rows[0];
    const { category_name, holder_name, ...snapshot } = record;
    await client.query(
      "insert into public.hof_deletion_logs (deleted_by, deleted_by_name, entity_type, entity_id, snapshot) values ($1, $2, 'hof_records', $3, $4::jsonb)",
      [req.sessionUser!.id, req.sessionUser!.username, req.params.id, JSON.stringify({ ...snapshot, category_name, holder_name })],
    );
    await client.query("delete from public.hof_records where id = $1", [req.params.id]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/guinness/categories/:id", ...manage, async (req, res, next) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ error: "Category id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const category = await client.query("select * from public.hof_categories where id = $1 for update", [req.params.id]);
    if (!category.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Category no longer exists." }); return; }
    const records = await client.query("select * from public.hof_records where category_id = $1 order by created_at for update", [req.params.id]);
    for (const record of records.rows) {
      const holder = await client.query("select username from public.profiles where id = $1", [record.holder_id]);
      await client.query(
        "insert into public.hof_deletion_logs (deleted_by, deleted_by_name, entity_type, entity_id, snapshot) values ($1, $2, 'hof_records', $3, $4::jsonb)",
        [req.sessionUser!.id, req.sessionUser!.username, record.id, JSON.stringify({ ...record, category_name: category.rows[0].name, holder_name: holder.rows[0]?.username ?? null })],
      );
    }
    await client.query(
      "insert into public.hof_deletion_logs (deleted_by, deleted_by_name, entity_type, entity_id, snapshot) values ($1, $2, 'hof_categories', $3, $4::jsonb)",
      [req.sessionUser!.id, req.sessionUser!.username, req.params.id, JSON.stringify({ ...category.rows[0], records: records.rows })],
    );
    await client.query("delete from public.hof_categories where id = $1", [req.params.id]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
