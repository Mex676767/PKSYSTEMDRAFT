import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

router.get("/dm/conversations", requireSession, requireApprovedSession, async (req, res, next) => {
  try {
    const result = await pool.query(
      `select c.id,c.user_a,c.user_b,c.created_at,c.last_message_at,
              jsonb_build_object('id',a.id,'username',a.username,'avatar_url',a.avatar_url,'active_border',a.active_border,'active_accessory',a.active_accessory) as "userA",
              jsonb_build_object('id',b.id,'username',b.username,'avatar_url',b.avatar_url,'active_border',b.active_border,'active_accessory',b.active_accessory) as "userB",
              (select count(*)::int from public.direct_messages m where m.conversation_id=c.id and m.sender_id<>$1 and m.read_at is null) as unread_count
         from public.dm_conversations c
         join public.profiles a on a.id=c.user_a
         join public.profiles b on b.id=c.user_b
        where $1 in (c.user_a,c.user_b)
        order by c.last_message_at desc`,
      [req.sessionUser!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/dm/conversations/:id/messages", requireSession, requireApprovedSession, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Conversation id is invalid." }); return; }
  try {
    const result = await pool.query(
      `select m.id,m.conversation_id,m.sender_id,m.body,m.read_at,m.created_at
         from public.direct_messages m
         join public.dm_conversations c on c.id=m.conversation_id
        where c.id=$1 and $2 in (c.user_a,c.user_b)
        order by m.created_at asc limit 500`,
      [id,req.sessionUser!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.post("/dm/conversations", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const otherUserId = req.body?.other_user_id;
  if (!isUuid(otherUserId) || otherUserId === req.sessionUser!.id) { res.status(400).json({ error: "Recipient is invalid." }); return; }
  try {
    const result = await pool.query(
      `with recipient as (select id from public.profiles where id=$1 and not is_deleted),
       pair as (select least($2::uuid,r.id) as user_a,greatest($2::uuid,r.id) as user_b from recipient r)
       insert into public.dm_conversations(user_a,user_b)
       select user_a,user_b from pair
       on conflict (user_a,user_b) do update set user_a=excluded.user_a
       returning id`,
      [otherUserId,req.sessionUser!.id],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Recipient not found." }); return; }
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { next(error); }
});

router.post("/dm/conversations/:id/messages", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const body = req.body?.body;
  if (!isUuid(id) || typeof body !== "string" || body.trim().length < 1 || body.length > 2000) { res.status(400).json({ error: "Message is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const conversation = await client.query("select user_a,user_b from public.dm_conversations where id=$1 for update", [id]);
    const row = conversation.rows[0];
    const senderId = req.sessionUser!.id;
    if (!row || (row.user_a !== senderId && row.user_b !== senderId)) {
      await client.query("rollback"); res.status(404).json({ error: "Conversation not found." }); return;
    }
    const recipientId = row.user_a === senderId ? row.user_b : row.user_a;
    const message = await client.query(
      "insert into public.direct_messages(conversation_id,sender_id,body) values($1,$2,$3) returning id",
      [id,senderId,body.trim()],
    );
    await client.query("update public.dm_conversations set last_message_at=now() where id=$1", [id]);
    await client.query(
      `insert into public.notifications(user_id,actor_id,type,target_type,target_id,message)
       values($1,$2,'dm','dm',$3,$4)`,
      [recipientId,senderId,id,`${req.sessionUser!.username ? `@${req.sessionUser!.username}` : "Someone"} sent you a message`],
    );
    await client.query("commit");
    res.status(201).json({ id: message.rows[0].id });
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

router.post("/dm/conversations/:id/read", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Conversation id is invalid." }); return; }
  try {
    await pool.query(
      `update public.direct_messages m set read_at=now()
        where m.conversation_id=$1 and m.sender_id<>$2 and m.read_at is null
          and exists(select 1 from public.dm_conversations c where c.id=$1 and $2 in (c.user_a,c.user_b))`,
      [id,req.sessionUser!.id],
    );
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete("/dm/messages/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Message id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.direct_messages where id=$1 and (sender_id=$2 or $3=true)", [id,req.sessionUser!.id,req.sessionUser!.is_admin]);
    if (!result.rowCount) { res.status(404).json({ error: "Message not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
