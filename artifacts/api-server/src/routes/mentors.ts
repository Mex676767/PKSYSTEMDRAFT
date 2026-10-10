import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const DEPARTMENTS = new Set(["RTN VIP", "RTN EXC", "MANAGEMENT", "DESIGN", "DATA ANALYST", "MARKETING"]);
const PERSON = "id,username,department,role,avatar_url,active_border,active_accessory,active_title,last_seen_at";

router.get("/mentorships", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select m.id,m.mentor_id,m.mentee_id,m.status,m.created_at,
        jsonb_build_object('username', mentor.username) as mentor,
        jsonb_build_object('username', mentee.username) as mentee
       from public.mentorships m
       join public.profiles mentor on mentor.id = m.mentor_id
       join public.profiles mentee on mentee.id = m.mentee_id
       order by m.created_at desc`,
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/directory", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(`select ${PERSON} from public.profiles where username is not null and is_deleted = false and is_hidden = false order by username`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.post("/mentorships", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { mentor_id: mentorId, mentee_id: menteeId } = req.body ?? {};
  if (!isUuid(mentorId) || !isUuid(menteeId) || mentorId === menteeId) { res.status(400).json({ error: "Mentorship pairing is invalid." }); return; }
  if (!req.sessionUser!.is_admin && !req.sessionUser!.permissions.includes("manage_mentors")) { res.status(403).json({ error: "You cannot manage mentor pairings." }); return; }
  try {
    const result = await pool.query(
      `insert into public.mentorships (mentor_id,mentee_id) values ($1,$2)
       returning id,mentor_id,mentee_id,status,created_at`,
      [mentorId, menteeId],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.patch("/mentorships/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body ?? {};
  if (!isUuid(id) || (status !== "active" && status !== "graduated")) { res.status(400).json({ error: "Mentorship status is invalid." }); return; }
  if (!req.sessionUser!.is_admin && !req.sessionUser!.permissions.includes("manage_mentors")) { res.status(403).json({ error: "You cannot manage mentor pairings." }); return; }
  try {
    const result = await pool.query("update public.mentorships set status = $2 where id = $1 returning id,mentor_id,mentee_id,status,created_at", [id, status]);
    if (!result.rowCount) { res.status(404).json({ error: "Mentorship not found." }); return; }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.delete("/mentorships/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Mentorship id is invalid." }); return; }
  if (!req.sessionUser!.is_admin && !req.sessionUser!.permissions.includes("manage_mentors")) { res.status(403).json({ error: "You cannot manage mentor pairings." }); return; }
  try {
    const result = await pool.query("delete from public.mentorships where id = $1", [id]);
    if (!result.rowCount) { res.status(404).json({ error: "Mentorship not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.patch("/admin/users/:id/department", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { department } = req.body ?? {};
  if (!isUuid(id) || (department !== null && (typeof department !== "string" || !DEPARTMENTS.has(department)))) { res.status(400).json({ error: "Department is invalid." }); return; }
  if (!req.sessionUser!.is_admin) { res.status(403).json({ error: "Admin access is required." }); return; }
  try {
    const result = await pool.query("update public.profiles set department = $2 where id = $1 returning id", [id, department]);
    if (!result.rowCount) { res.status(404).json({ error: "User not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
