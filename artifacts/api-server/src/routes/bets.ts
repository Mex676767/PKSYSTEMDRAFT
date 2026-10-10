import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const canManageBets = (user: NonNullable<Express.Request["sessionUser"]>) => user.is_admin || user.permissions.includes("manage_bets");

router.get("/bets", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select b.*,jsonb_build_object('username',p.username) as creator from public.bets b join public.profiles p on p.id=b.creator_id order by b.created_at desc`)).rows); }
  catch (error) { next(error); }
});

router.get("/bets/options", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select id,bet_id,label from public.bet_options order by label")).rows); }
  catch (error) { next(error); }
});

router.get("/bets/wagers", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query(`select w.*,jsonb_build_object('username',p.username) as user from public.bet_wagers w join public.profiles p on p.id=w.user_id`)).rows); }
  catch (error) { next(error); }
});

router.post("/bets", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { title, options, closes_at: closesAt } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200 || !Array.isArray(options) || options.length < 2 || options.length > 20 || !options.every((label: unknown) => typeof label === "string" && label.trim().length > 0 && label.trim().length <= 100) || (closesAt != null && (typeof closesAt !== "string" || Number.isNaN(Date.parse(closesAt))))) { res.status(400).json({ error: "Bet details are invalid." }); return; }
  const cleanOptions = options.map((label: string) => label.trim());
  if (new Set(cleanOptions.map((label: string) => label.toLocaleLowerCase())).size !== cleanOptions.length) { res.status(400).json({ error: "Bet options must be unique." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const bet = await client.query("insert into public.bets (creator_id,title,closes_at) values ($1,$2,$3) returning id", [req.sessionUser!.id, title.trim(), closesAt ?? null]);
    for (const label of cleanOptions) await client.query("insert into public.bet_options (bet_id,label) values ($1,$2)", [bet.rows[0].id, label]);
    await client.query("commit");
    res.status(201).json({ id: bet.rows[0].id });
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.post("/bets/:id/wagers", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const betId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { option_id: optionId, amount } = req.body ?? {};
  if (!isUuid(betId) || !isUuid(optionId) || !Number.isInteger(amount) || amount <= 0 || amount > 100000) { res.status(400).json({ error: "Wager details are invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const bet = await client.query<{ status: string; closes_at: Date | null }>("select status,closes_at from public.bets where id=$1 for update", [betId]);
    if (!bet.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Bet not found." }); return; }
    if (bet.rows[0].status !== "open") { await client.query("rollback"); res.status(400).json({ error: "This bet is no longer open." }); return; }
    if (bet.rows[0].closes_at && new Date(bet.rows[0].closes_at).getTime() < Date.now()) { await client.query("rollback"); res.status(400).json({ error: "Betting has closed for this bet." }); return; }
    if (!(await client.query("select 1 from public.bet_options where id=$1 and bet_id=$2", [optionId, betId])).rowCount) { await client.query("rollback"); res.status(400).json({ error: "Invalid option for this bet." }); return; }
    const profile = await client.query<{ points: number }>("select points from public.profiles where id=$1 and is_deleted=false for update", [req.sessionUser!.id]);
    if (!profile.rowCount || profile.rows[0].points < amount) { await client.query("rollback"); res.status(400).json({ error: "Not enough points." }); return; }
    if ((await client.query("select 1 from public.bet_wagers where bet_id=$1 and user_id=$2", [betId, req.sessionUser!.id])).rowCount) { await client.query("rollback"); res.status(409).json({ error: "You already placed a wager on this bet." }); return; }
    await client.query("insert into public.bet_wagers (bet_id,option_id,user_id,amount) values ($1,$2,$3,$4)", [betId, optionId, req.sessionUser!.id, amount]);
    await client.query("insert into public.point_transactions (user_id,amount,reason) values ($1,$2,'Wager placed')", [req.sessionUser!.id, -amount]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.post("/bets/:id/resolve", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const betId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { winning_option_id: winningOptionId } = req.body ?? {};
  if (!isUuid(betId) || !isUuid(winningOptionId)) { res.status(400).json({ error: "Bet resolution is invalid." }); return; }
  if (!canManageBets(req.sessionUser!)) { res.status(403).json({ error: "Bet management permission is required." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const bet = await client.query<{ status: string }>("select status from public.bets where id=$1 for update", [betId]);
    if (!bet.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Bet not found." }); return; }
    if (bet.rows[0].status !== "open") { await client.query("rollback"); res.status(409).json({ error: "Bet is not open." }); return; }
    if (!(await client.query("select 1 from public.bet_options where id=$1 and bet_id=$2", [winningOptionId, betId])).rowCount) { await client.query("rollback"); res.status(400).json({ error: "Winning option is invalid." }); return; }
    const wagers = await client.query<{ user_id: string; option_id: string; amount: number }>("select user_id,option_id,amount from public.bet_wagers where bet_id=$1", [betId]);
    const totalPool = wagers.rows.reduce((sum, wager) => sum + wager.amount, 0);
    const winningWagers = wagers.rows.filter((wager) => wager.option_id === winningOptionId);
    const winningPool = winningWagers.reduce((sum, wager) => sum + wager.amount, 0);
    if (winningPool > 0) {
      for (const wager of winningWagers) {
        const payout = Math.round((wager.amount / winningPool) * totalPool);
        if (payout > 0) await client.query("insert into public.point_transactions (user_id,amount,reason) values ($1,$2,'Won a bet')", [wager.user_id, payout]);
      }
    } else {
      for (const wager of wagers.rows) await client.query("insert into public.point_transactions (user_id,amount,reason) values ($1,$2,'Bet refunded (no winners)')", [wager.user_id, wager.amount]);
    }
    await client.query("update public.bets set status='resolved',winning_option_id=$2 where id=$1", [betId, winningOptionId]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.post("/bets/:id/cancel", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const betId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(betId)) { res.status(400).json({ error: "Bet id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const bet = await client.query<{ status: string; creator_id: string }>("select status,creator_id from public.bets where id=$1 for update", [betId]);
    if (!bet.rowCount) { await client.query("rollback"); res.status(404).json({ error: "Bet not found." }); return; }
    if (bet.rows[0].status !== "open") { await client.query("rollback"); res.status(409).json({ error: "Bet is not open." }); return; }
    if (!canManageBets(req.sessionUser!) && bet.rows[0].creator_id !== req.sessionUser!.id) { await client.query("rollback"); res.status(403).json({ error: "You cannot cancel this bet." }); return; }
    await client.query("insert into public.point_transactions (user_id,amount,reason) select user_id,amount,'Bet cancelled (refund)' from public.bet_wagers where bet_id=$1", [betId]);
    await client.query("update public.bets set status='cancelled' where id=$1", [betId]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
