import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
type Kind = "role" | "department";
const isKind = (value: unknown): value is Kind => value === "role" || value === "department";
const isAdmin = (req: import("express").Request) => Boolean(req.sessionUser?.is_admin);

router.get("/org-structure", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const [roles, departments] = await Promise.all([
      pool.query<{ name: string }>("select name from public.org_roles order by rank, name"),
      pool.query<{ name: string }>("select name from public.org_departments order by name"),
    ]);
    res.json({ roles: roles.rows.map((row) => row.name), departments: departments.rows.map((row) => row.name), managed: true });
  } catch (error) { next(error); }
});

router.put("/profile/role-department", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { role, department } = req.body ?? {};
  if (typeof role !== "string" || typeof department !== "string") { res.status(400).json({ error: "Choose a role and department." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const profile = await client.query<{ role: string | null; department: string | null }>("select role, department from public.profiles where id = $1 for update", [req.sessionUser!.id]);
    if (!profile.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Account not found." }); return; }
    if (profile.rows[0].role !== null || profile.rows[0].department !== null) { await client.query("rollback"); res.status(409).json({ error: "Your role and department are already set. Ask an admin to change them." }); return; }
    const validRole = await client.query("select 1 from public.org_roles where name = $1", [role]);
    const validDepartment = await client.query("select 1 from public.org_departments where name = $1", [department]);
    if (!validRole.rowCount || !validDepartment.rowCount) { await client.query("rollback"); res.status(400).json({ error: "Choose a valid role and department." }); return; }
    await client.query("update public.profiles set role = $2, department = $3 where id = $1", [req.sessionUser!.id, role, department]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.put("/admin/profiles/:id/role-department", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  const { role, department } = req.body ?? {};
  if ((role !== null && typeof role !== "string") || (department !== null && typeof department !== "string")) { res.status(400).json({ error: "Role or department is invalid." }); return; }
  try {
    if (role !== null && !(await pool.query("select 1 from public.org_roles where name = $1", [role])).rowCount) { res.status(400).json({ error: "Invalid role." }); return; }
    if (department !== null && !(await pool.query("select 1 from public.org_departments where name = $1", [department])).rowCount) { res.status(400).json({ error: "Invalid department." }); return; }
    const result = await pool.query("update public.profiles set role = $2, department = $3 where id = $1", [req.params.id, role, department]);
    if (!result.rowCount) { res.status(404).json({ error: "Account not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/admin/org-structure", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  const { kind, old_name: oldName, new_name: newName } = req.body ?? {};
  const name = typeof newName === "string" ? newName.trim().toUpperCase() : "";
  if (!isKind(kind) || (oldName !== null && typeof oldName !== "string") || !name || name.length > 40) { res.status(400).json({ error: "Organization item details are invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const table = kind === "role" ? "org_roles" : "org_departments";
    const orderColumn = kind === "role" ? "rank" : "sort";
    const exists = await client.query(`select 1 from public.${table} where name = $1`, [name]);
    if (name !== oldName && exists.rowCount) { await client.query("rollback"); res.status(409).json({ error: `“${name}” already exists.` }); return; }
    if (oldName === null) {
      await client.query(`insert into public.${table} (name, ${orderColumn}) values ($1, coalesce((select max(${orderColumn}) from public.${table}), 0) + 1)`, [name]);
    } else {
      const update = await client.query(`update public.${table} set name = $2 where name = $1`, [oldName, name]);
      if (!update.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Organization item not found." }); return; }
      if (kind === "role") await client.query("update public.profiles set role = $2 where role = $1", [oldName, name]);
      else {
        await client.query("update public.profiles set department = $2 where department = $1", [oldName, name]);
        await client.query("update public.hof_award_categories set department = $2 where department = $1", [oldName, name]);
      }
    }
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.put("/admin/org-structure/order", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  const { kind, name, direction } = req.body ?? {};
  if (!isKind(kind) || typeof name !== "string" || (direction !== -1 && direction !== 1)) { res.status(400).json({ error: "Organization item or direction is invalid." }); return; }
  const table = kind === "role" ? "org_roles" : "org_departments";
  const orderColumn = kind === "role" ? "rank" : "sort";
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rows = await client.query<{ name: string; order_value: number }>(`select name, ${orderColumn} as order_value from public.${table} order by ${orderColumn} for update`);
    const index = rows.rows.findIndex((row) => row.name === name);
    const otherIndex = index + direction;
    if (index >= 0 && otherIndex >= 0 && otherIndex < rows.rows.length) {
      const next = [...rows.rows];
      [next[index], next[otherIndex]] = [next[otherIndex], next[index]];
      await client.query(`update public.${table} set ${orderColumn} = ${orderColumn} + 1000000`);
      for (const [position, row] of next.entries()) await client.query(`update public.${table} set ${orderColumn} = $2 where name = $1`, [row.name, position + 1]);
    }
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.delete("/admin/org-structure/:kind/:name", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access is required." }); return; }
  const kind = req.params.kind;
  const name = req.params.name;
  if (!isKind(kind) || typeof name !== "string" || !name) { res.status(400).json({ error: "Organization item is invalid." }); return; }
  try {
    const column = kind === "role" ? "role" : "department";
    const inUse = await pool.query("select count(*)::int as count from public.profiles where " + column + " = $1", [name]);
    if (inUse.rows[0].count > 0) { res.status(409).json({ error: `${inUse.rows[0].count} account(s) still use “${name}”. Reassign them first.` }); return; }
    const table = kind === "role" ? "org_roles" : "org_departments";
    const result = await pool.query(`delete from public.${table} where name = $1`, [name]);
    if (!result.rowCount) { res.status(404).json({ error: "Organization item not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
