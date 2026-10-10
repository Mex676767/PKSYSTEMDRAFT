import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
type Status = "correct" | "present" | "absent";

router.get("/wordle/attempts/today", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    res.json((await pool.query("select id, guess_number, guess, statuses, created_at from public.wordle_attempts where user_id = $1 and play_date = current_date order by guess_number", [req.sessionUser!.id])).rows);
  } catch (error) { next(error); }
});

router.get("/wordle/result/today", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    res.json((await pool.query("select id, user_id, solved, guess_count, duration_seconds from public.wordle_results where user_id = $1 and play_date = current_date", [req.sessionUser!.id])).rows[0] ?? null);
  } catch (error) { next(error); }
});

router.get("/wordle/leaderboard", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    res.json((await pool.query(
      `select r.user_id, r.guess_count, r.duration_seconds, jsonb_build_object('username',p.username) as profile
         from public.wordle_results r join public.profiles p on p.id = r.user_id
        where r.play_date = current_date and r.solved = true and p.is_hidden = false and p.is_deleted = false
        order by r.duration_seconds asc nulls last limit 10`,
    )).rows);
  } catch (error) { next(error); }
});

router.post("/wordle/guess", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const guess = typeof req.body?.guess === "string" ? req.body.guess.trim().toLowerCase() : "";
  if (!/^[a-z]{5}$/.test(guess)) { res.status(400).json({ error: "Guess must be five letters." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const userId = req.sessionUser!.id;
    await client.query("select id from public.profiles where id = $1 for update", [userId]);
    if (!(await client.query("select 1 from public.wordle_valid_guesses where word = $1", [guess])).rowCount) { await client.query("rollback"); res.status(400).json({ error: "Not a valid word." }); return; }
    if ((await client.query("select 1 from public.wordle_results where user_id = $1 and play_date = current_date", [userId])).rowCount) { await client.query("rollback"); res.status(409).json({ error: "You already finished today’s puzzle." }); return; }
    const count = await client.query<{ count: number }>("select count(*)::int as count from public.wordle_attempts where user_id = $1 and play_date = current_date", [userId]);
    const existingAttempts = count.rows[0].count;
    if (existingAttempts >= 6) { await client.query("rollback"); res.status(409).json({ error: "No attempts remaining." }); return; }
    const targetResult = await client.query<{ word: string }>(
      `select word from public.wordle_words order by id offset
         ((extract(epoch from current_date)::bigint / 86400) % (select count(*) from public.wordle_words)) limit 1`,
    );
    const target = targetResult.rows[0]?.word;
    if (!target) throw new Error("No daily Wordle word is configured.");
    const statuses = Array(5).fill("absent") as Status[];
    const remaining = new Map<string, number>();
    for (let index = 0; index < 5; index++) {
      if (guess[index] === target[index]) statuses[index] = "correct";
      else remaining.set(target[index], (remaining.get(target[index]) ?? 0) + 1);
    }
    for (let index = 0; index < 5; index++) {
      if (statuses[index] === "correct") continue;
      const lettersLeft = remaining.get(guess[index]) ?? 0;
      if (lettersLeft > 0) { statuses[index] = "present"; remaining.set(guess[index], lettersLeft - 1); }
    }
    const guessNumber = existingAttempts + 1;
    const correct = guess === target;
    await client.query("insert into public.wordle_attempts (user_id,play_date,guess_number,guess,statuses) values ($1,current_date,$2,$3,$4)", [userId, guessNumber, guess, statuses]);
    if (correct || guessNumber >= 6) {
      const duration = await client.query<{ seconds: number }>("select extract(epoch from (now() - min(created_at)))::int as seconds from public.wordle_attempts where user_id = $1 and play_date = current_date", [userId]);
      await client.query("insert into public.wordle_results (user_id,play_date,solved,guess_count,duration_seconds) values ($1,current_date,$2,$3,$4)", [userId, correct, guessNumber, correct ? duration.rows[0].seconds : null]);
      if (correct) {
        await client.query("select set_config('app.points_allowed','on',true)");
        await client.query("insert into public.point_transactions (user_id,amount,reason) values ($1,$2,'Solved today’s Wordle')", [userId, Math.max(30 - existingAttempts * 3, 10)]);
        await client.query("select set_config('app.points_allowed','off',true)");
        await client.query("select public.award_title($1,'word_wizard')", [userId]);
      }
    }
    await client.query("commit");
    res.json({ statuses, correct, guess_number: guessNumber, attempts_remaining: 6 - guessNumber, target: correct || guessNumber >= 6 ? target : null });
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
