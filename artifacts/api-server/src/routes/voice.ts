import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validChannel = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 120;
const signalTypes = new Set(["offer", "answer", "candidate"]);

router.get("/voice/presence", requireSession, requireApprovedSession, async (req, res, next) => {
  const channels = typeof req.query.channels === "string" ? [...new Set(req.query.channels.split(","))] : [];
  if (channels.length > 50 || channels.some((channel) => !validChannel(channel))) { res.status(400).json({ error: "Voice channels are invalid." }); return; }
  if (!channels.length) { res.json([]); return; }
  try {
    const result = await pool.query(
      `select v.channel_id,v.user_id as id,v.username,v.muted,v.deafened,v.streaming
         from public.voice_presence v join public.profiles p on p.id=v.user_id
        where v.channel_id=any($1::text[]) and v.last_seen_at > now()-interval '20 seconds'
          and p.is_deleted=false and p.is_hidden=false order by v.channel_id,v.username`, [channels]);
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.put("/voice/:channelId/presence", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
  const { username, muted, deafened, streaming } = req.body ?? {};
  if (!validChannel(channelId) || typeof username !== "string" || username.length < 1 || username.length > 80 || typeof muted !== "boolean" || typeof deafened !== "boolean" || typeof streaming !== "boolean") { res.status(400).json({ error: "Voice presence details are invalid." }); return; }
  try {
    await pool.query(`insert into public.voice_presence(channel_id,user_id,username,muted,deafened,streaming,last_seen_at)
      values($1,$2,$3,$4,$5,$6,now()) on conflict(channel_id,user_id) do update set username=excluded.username,muted=excluded.muted,deafened=excluded.deafened,streaming=excluded.streaming,last_seen_at=now()`,
    [channelId, req.sessionUser!.id, username, muted, deafened, streaming]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/voice/:channelId/presence", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
  if (!validChannel(channelId)) { res.status(400).json({ error: "Voice channel is invalid." }); return; }
  try {
    await pool.query("delete from public.voice_presence where channel_id=$1 and user_id=$2", [channelId, req.sessionUser!.id]);
    await pool.query("delete from public.voice_signals where channel_id=$1 and (from_user_id=$2 or to_user_id=$2)", [channelId, req.sessionUser!.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/voice/:channelId/signals", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
  const { to, payload } = req.body ?? {};
  if (!validChannel(channelId) || !isUuid(to) || typeof payload !== "object" || payload === null || !signalTypes.has(payload.type) || payload.from !== req.sessionUser!.id || payload.to !== to || JSON.stringify(payload).length > 60_000) { res.status(400).json({ error: "Voice signal is invalid." }); return; }
  try {
    const participants = await pool.query("select 1 from public.voice_presence where channel_id=$1 and user_id=any($2::uuid[]) and last_seen_at>now()-interval '20 seconds'", [channelId, [req.sessionUser!.id, to]]);
    if (participants.rowCount !== 2) { res.status(403).json({ error: "Both callers must be in the voice channel." }); return; }
    await pool.query("insert into public.voice_signals(channel_id,from_user_id,to_user_id,payload) values($1,$2,$3,$4::jsonb)", [channelId, req.sessionUser!.id, to, JSON.stringify(payload)]);
    res.status(202).end();
  } catch (error) { next(error); }
});

router.get("/voice/:channelId/signals", requireSession, requireApprovedSession, async (req, res, next) => {
  const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
  if (!validChannel(channelId)) { res.status(400).json({ error: "Voice channel is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query("delete from public.voice_signals where id in (select id from public.voice_signals where channel_id=$1 and to_user_id=$2 order by id limit 100 for update skip locked) returning payload", [channelId, req.sessionUser!.id]);
    await client.query("commit");
    res.json(result.rows.map((row) => row.payload));
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.post("/voice/:channelId/sessions/start", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
  if (!validChannel(channelId)) { res.status(400).json({ error: "Voice channel is invalid." }); return; }
  try {
    await pool.query("update public.voice_sessions set left_at=now() where user_id=$1 and left_at is null", [req.sessionUser!.id]);
    await pool.query("insert into public.voice_sessions(user_id,channel_id) values($1,$2)", [req.sessionUser!.id, channelId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/voice/sessions/stop", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  try { await pool.query("update public.voice_sessions set left_at=now() where user_id=$1 and left_at is null", [req.sessionUser!.id]); res.status(204).end(); }
  catch (error) { next(error); }
});

export default router;
