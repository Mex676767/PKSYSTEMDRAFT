import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAnyPermission, requirePermission, requireApprovedSession, requireSession, assertAllowedBrowserOrigin } from "../middleware/session-auth";
import { validateWinnerSet } from "../lib/hof-validation";

const router: IRouter = Router();
const manage = [requireSession, requireApprovedSession, assertAllowedBrowserOrigin, requirePermission("manage_hof_awards")];

type WinnerInput = {
  rank: number;
  user_id: string;
  achievement: string;
  team_member_ids: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseWinnerInput(value: unknown): WinnerInput[] | null {
  if (!Array.isArray(value) || value.length > 300) return null;
  const parsed: WinnerInput[] = [];
  for (const row of value) {
    if (!isRecord(row) || !Number.isInteger(row.rank) || (row.rank as number) < 1 || (row.rank as number) > 3 || !isUuid(row.user_id)) return null;
    if (typeof row.achievement !== "string" || row.achievement.length > 150) return null;
    const members = row.team_member_ids ?? [];
    if (!Array.isArray(members) || members.some((id) => !isUuid(id))) return null;
    parsed.push({ rank: row.rank as number, user_id: row.user_id, achievement: row.achievement, team_member_ids: members as string[] });
  }
  return parsed;
}

function isMonthStart(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value);
}

function sendDatabaseError(error: unknown, res: Response) {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  if (code === "23505") {
    res.status(409).json({ error: "That Hall of Fame category or winner already exists." });
    return;
  }
  if (code === "23503") {
    res.status(400).json({ error: "One or more selected people or categories no longer exist." });
    return;
  }
  throw error;
}

router.get("/hall-of-fame/award-categories", requireSession, requireApprovedSession, async (req, res, next) => {
  const department = req.query.department;
  if (typeof department !== "string" || department.trim().length === 0 || department.length > 40) {
    res.status(400).json({ error: "A valid department is required." });
    return;
  }
  try {
    const result = await pool.query(
      `select id, department, name, award_type, created_at
         from public.hof_award_categories where department = $1 order by created_at, id`,
      [department],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/hall-of-fame/departments", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select name, show_in_hall_of_fame from public.org_departments order by sort, name`,
    );
    res.json({ configured: true, departments: result.rows });
  } catch (error) { next(error); }
});

router.put("/hall-of-fame/departments/:name/visibility", ...manage, async (req, res, next) => {
  const name = req.params.name;
  const visible = isRecord(req.body) ? req.body.visible : undefined;
  if (!name || name.length > 40 || typeof visible !== "boolean") {
    res.status(400).json({ error: "A department and boolean visibility value are required." });
    return;
  }
  try {
    const result = await pool.query(
      `update public.org_departments set show_in_hall_of_fame = $2 where name = $1 returning name, show_in_hall_of_fame`,
      [name, visible],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Department not found." }); return; }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.get("/hall-of-fame/award-winners", requireSession, requireApprovedSession, async (req, res, next) => {
  const month = req.query.month;
  if (!isMonthStart(month)) { res.status(400).json({ error: "Month must be the first day of a calendar month." }); return; }
  try {
    const result = await pool.query(
      `select w.id, w.category_id, w.month, w.rank, w.user_id, w.achievement,
              coalesce(w.team_member_ids, '{}'::uuid[]) as team_member_ids,
              case when holder.id is null then null else jsonb_build_object(
                'username', holder.username, 'role', holder.role, 'avatar_url', holder.avatar_url,
                'active_border', holder.active_border, 'active_accessory', holder.active_accessory
              ) end as holder,
              coalesce((select jsonb_agg(jsonb_build_object('user_id', member.id, 'username', member.username)
                                         order by array_position(w.team_member_ids, member.id))
                          from public.profiles member where member.id = any(w.team_member_ids)), '[]'::jsonb) as team_members
         from public.hof_award_winners w
         left join public.profiles holder on holder.id = w.user_id
        where w.month = $1::date order by w.rank, w.category_id, w.user_id`,
      [month],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/hall-of-fame/deletion-logs", requireSession, requireApprovedSession, requireAnyPermission("manage_hof_awards", "manage_hall_of_fame"), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select id, deleted_at, deleted_by_name, entity_type, entity_id, snapshot
         from public.hof_deletion_logs order by deleted_at desc limit 100`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.post("/hall-of-fame/award-categories", ...manage, async (req, res, next) => {
  const body = req.body;
  if (!isRecord(body) || typeof body.department !== "string" || body.department.trim().length === 0 || body.department.length > 40 || typeof body.name !== "string" || body.name.trim().length === 0 || body.name.trim().length > 100 || (body.award_type !== "individual" && body.award_type !== "team")) {
    res.status(400).json({ error: "Department, name, and award type are invalid." });
    return;
  }
  try {
    const result = await pool.query(
      `insert into public.hof_award_categories (department, name, award_type) values ($1, $2, $3)
       returning id, department, name, award_type, created_at`,
      [body.department.trim(), body.name.trim(), body.award_type],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { try { sendDatabaseError(error, res); } catch (unhandled) { next(unhandled); } }
});

router.patch("/hall-of-fame/award-categories/:id", ...manage, async (req, res, next) => {
  const { id } = req.params;
  const body = req.body;
  if (!isUuid(id) || !isRecord(body) || typeof body.department !== "string" || body.department.trim().length === 0 || body.department.length > 40 || typeof body.name !== "string" || body.name.trim().length === 0 || body.name.trim().length > 100 || (body.award_type !== "individual" && body.award_type !== "team")) {
    res.status(400).json({ error: "Category details are invalid." });
    return;
  }
  try {
    const result = await pool.query(
      `update public.hof_award_categories set department = $2, name = $3, award_type = $4 where id = $1
       returning id, department, name, award_type, created_at`,
      [id, body.department.trim(), body.name.trim(), body.award_type],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Category not found." }); return; }
    res.json(result.rows[0]);
  } catch (error) { try { sendDatabaseError(error, res); } catch (unhandled) { next(unhandled); } }
});

router.delete("/hall-of-fame/award-categories/:id", ...manage, async (req, res, next) => {
  const { id } = req.params;
  if (!isUuid(id)) { res.status(400).json({ error: "Category id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const category = await client.query("select * from public.hof_award_categories where id = $1 for update", [id]);
    if (!category.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Category not found." }); return; }
    const winners = await client.query("select * from public.hof_award_winners where category_id = $1 order by month, rank, user_id", [id]);
    const user = req.sessionUser!;
    await client.query(
      `insert into public.hof_deletion_logs (deleted_by, deleted_by_name, entity_type, entity_id, snapshot)
       values ($1, $2, 'hof_award_categories', $3, $4::jsonb)`,
      [user.id, user.username, id, JSON.stringify({ ...category.rows[0], winners: winners.rows })],
    );
    await client.query("delete from public.hof_award_categories where id = $1", [id]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.put("/hall-of-fame/award-categories/:id/winners", ...manage, async (req, res, next) => {
  const { id } = req.params;
  const month = isRecord(req.body) ? req.body.month : undefined;
  const winners = isRecord(req.body) ? parseWinnerInput(req.body.winners) : null;
  if (!isUuid(id) || !isMonthStart(month) || !winners) {
    res.status(400).json({ error: "Category, month, or winner details are invalid." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const category = await client.query<{ award_type: "individual" | "team" }>(
      "select award_type from public.hof_award_categories where id = $1 for update", [id],
    );
    if (!category.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Category no longer exists." }); return; }
    const winnerError = validateWinnerSet(category.rows[0].award_type, winners);
    if (winnerError) { await client.query("rollback"); res.status(400).json({ error: winnerError }); return; }
    const people = [...new Set(winners.flatMap((winner) => [winner.user_id, ...winner.team_member_ids]))];
    if (people.length) {
      const existing = await client.query("select id from public.profiles where id = any($1::uuid[])", [people]);
      if (existing.rowCount !== people.length) {
        await client.query("rollback"); res.status(400).json({ error: "One or more selected people no longer exist." }); return;
      }
    }
    const before = await client.query(
      "select * from public.hof_award_winners where category_id = $1 and month = $2::date order by rank, user_id", [id, month],
    );
    if (before.rowCount) {
      await client.query(
        `insert into public.hof_deletion_logs (deleted_by, deleted_by_name, entity_type, entity_id, snapshot)
         values ($1, $2, 'hof_award_winners', $3, jsonb_build_object('category_id', $3, 'month', $4::date, 'winners', $5::jsonb))`,
        [req.sessionUser!.id, req.sessionUser!.username, id, month, JSON.stringify(before.rows)],
      );
    }
    await client.query("delete from public.hof_award_winners where category_id = $1 and month = $2::date", [id, month]);
    for (const winner of winners) {
      await client.query(
        `insert into public.hof_award_winners (category_id, month, rank, user_id, achievement, team_member_ids)
         values ($1, $2::date, $3, $4, $5, $6::uuid[])`,
        [id, month, winner.rank, winner.user_id, winner.achievement, winner.team_member_ids],
      );
    }
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); try { sendDatabaseError(error, res); } catch (unhandled) { next(unhandled); } }
  finally { client.release(); }
});

export default router;
