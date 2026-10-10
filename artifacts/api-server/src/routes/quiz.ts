import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
function admin(req: import("express").Request, res: import("express").Response) {
  if (req.sessionUser!.is_admin) return true;
  res.status(403).json({ error: "Admin access is required." });
  return false;
}

router.get("/quiz/questions", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select id, question, options from public.quiz_questions order by created_at")).rows); }
  catch (error) { next(error); }
});

router.get("/quiz/answers/me", requireSession, requireApprovedSession, async (req, res, next) => {
  try { res.json((await pool.query("select question_id, selected_index, correct from public.quiz_answers where user_id = $1", [req.sessionUser!.id])).rows); }
  catch (error) { next(error); }
});

router.get("/quiz/leaderboard", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    res.json((await pool.query(
      `select a.user_id, p.username, count(*) filter (where a.correct)::int as correct_count, count(*)::int as total_answered
         from public.quiz_answers a join public.profiles p on p.id = a.user_id
        where p.is_deleted = false and p.is_hidden = false group by a.user_id, p.username order by correct_count desc, total_answered desc`,
    )).rows);
  } catch (error) { next(error); }
});

router.post("/quiz/answers", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { question_id: questionId, selected_index: selectedIndex } = req.body ?? {};
  if (typeof questionId !== "string" || !/^[0-9a-f-]{36}$/i.test(questionId) || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 20) { res.status(400).json({ error: "Answer details are invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const question = await client.query<{ correct_index: number; options: string[] }>("select correct_index, options from public.quiz_questions where id = $1 for update", [questionId]);
    if (!question.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Question not found." }); return; }
    if (selectedIndex >= question.rows[0].options.length) { await client.query("rollback"); res.status(400).json({ error: "Selected answer is invalid." }); return; }
    const userId = req.sessionUser!.id;
    if ((await client.query("select 1 from public.quiz_answers where user_id = $1 and question_id = $2", [userId, questionId])).rowCount) { await client.query("rollback"); res.status(409).json({ error: "Already answered this question." }); return; }
    const correct = selectedIndex === question.rows[0].correct_index;
    await client.query("insert into public.quiz_answers (user_id, question_id, selected_index, correct) values ($1,$2,$3,$4)", [userId, questionId, selectedIndex, correct]);
    if (correct) {
      await client.query("select set_config('app.points_allowed','on',true)");
      await client.query("insert into public.point_transactions (user_id,amount,reason) values ($1,15,'Answered a quiz question correctly')", [userId]);
      await client.query("select set_config('app.points_allowed','off',true)");
      const total = await client.query<{ count: number }>("select count(*)::int as count from public.quiz_answers where user_id = $1 and correct", [userId]);
      if (total.rows[0].count >= 5) await client.query("select public.award_title($1,'quiz_whiz')", [userId]);
    }
    await client.query("commit");
    res.json({ correct, correct_index: question.rows[0].correct_index });
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.get("/admin/quiz/questions", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!admin(req, res)) return;
  try { res.json((await pool.query("select id, question, options, correct_index, created_at from public.quiz_questions order by created_at desc")).rows); }
  catch (error) { next(error); }
});

router.post("/admin/quiz/questions", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!admin(req, res)) return;
  const { question, options, correct_index: correctIndex } = req.body ?? {};
  if (typeof question !== "string" || !question.trim() || question.length > 1000 || !Array.isArray(options) || options.length < 2 || options.length > 10 || options.some((option: unknown) => typeof option !== "string" || !option.trim() || option.length > 300) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) { res.status(400).json({ error: "Question details are invalid." }); return; }
  try {
    const result = await pool.query("insert into public.quiz_questions (question, options, correct_index, created_by) values ($1,$2,$3,$4) returning id", [question.trim(), options.map((option: string) => option.trim()), correctIndex, req.sessionUser!.id]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { next(error); }
});

router.delete("/admin/quiz/questions/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  if (!admin(req, res)) return;
  try {
    const result = await pool.query("delete from public.quiz_questions where id = $1", [req.params.id]);
    if (!result.rowCount) { res.status(404).json({ error: "Question not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
