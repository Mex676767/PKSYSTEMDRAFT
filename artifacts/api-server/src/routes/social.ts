import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const TARGET_TYPES = new Set(["goal", "birthday", "post", "hof_record", "challenge", "profile"]);
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const COMMENT_PERSON = "jsonb_build_object('username',p.username,'avatar_url',p.avatar_url,'active_border',p.active_border,'active_accessory',p.active_accessory)";
const REACTION_PERSON = "jsonb_build_object('username',p.username)";
const parseTargetIds = (value: unknown) => typeof value === "string" ? [...new Set(value.split(",").filter((id) => id.length > 0))] : [];

router.get("/social/mentionable-profiles", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select id,username from public.profiles where username is not null and is_deleted=false and is_hidden=false order by username")).rows); }
  catch (error) { next(error); }
});

router.get("/social/comments/:targetType/:targetId", requireSession, requireApprovedSession, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const targetId = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  if (!TARGET_TYPES.has(targetType) || !targetId || targetId.length > 200) { res.status(400).json({ error: "Comment target is invalid." }); return; }
  try {
    res.json((await pool.query(`select c.id,c.target_type,c.target_id,c.author_id,c.body,c.parent_comment_id,c.created_at,${COMMENT_PERSON} as author from public.comments c join public.profiles p on p.id=c.author_id where c.target_type=$1 and c.target_id=$2 order by c.created_at asc`, [targetType,targetId])).rows);
  } catch (error) { next(error); }
});

router.get("/social/comments/:targetType", requireSession, requireApprovedSession, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const ids = parseTargetIds(req.query.target_ids);
  if (!TARGET_TYPES.has(targetType) || ids.length > 500 || ids.some((id) => id.length > 200)) { res.status(400).json({ error: "Comment targets are invalid." }); return; }
  if (!ids.length) { res.json([]); return; }
  try {
    res.json((await pool.query(`select c.id,c.target_type,c.target_id,c.author_id,c.body,c.parent_comment_id,c.created_at,${COMMENT_PERSON} as author from public.comments c join public.profiles p on p.id=c.author_id where c.target_type=$1 and c.target_id=any($2::text[]) order by c.created_at desc`, [targetType,ids])).rows);
  } catch (error) { next(error); }
});

router.post("/social/comments/:targetType/:targetId", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const targetId = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  const { body, parent_comment_id: parentId } = req.body ?? {};
  if (!TARGET_TYPES.has(targetType) || !targetId || targetId.length > 200 || typeof body !== "string" || body.trim().length < 1 || body.length > 2000 || (parentId != null && !isUuid(parentId))) { res.status(400).json({ error: "Comment details are invalid." }); return; }
  try {
    if (parentId) {
      const parent = await pool.query("select 1 from public.comments where id=$1 and target_type=$2 and target_id=$3", [parentId,targetType,targetId]);
      if (!parent.rowCount) { res.status(400).json({ error: "Reply target is invalid." }); return; }
    }
    const client = await pool.connect();
    let commentId: string;
    try {
      await client.query("begin");
      const result = await client.query("insert into public.comments (target_type,target_id,author_id,body,parent_comment_id) values ($1,$2,$3,$4,$5) returning id", [targetType,targetId,req.sessionUser!.id,body.trim(),parentId ?? null]);
      commentId = result.rows[0].id;
      const mentions = [...new Set([...body.matchAll(/@([a-zA-Z0-9_]{3,20})/g)].map((match) => match[1].toLowerCase()))];
      if (mentions.length) {
        await client.query(
          `insert into public.notifications(user_id,actor_id,type,target_type,target_id,comment_id,message)
           select p.id,$1,'comment',$5,$6,$2,$3 from public.profiles p
            where lower(p.username)=any($4::text[]) and p.id<>$1
              and not exists (select 1 from public.notifications n where n.user_id=p.id and n.comment_id=$2)
              and p.is_deleted=false`,
          [req.sessionUser!.id,commentId,`@${req.sessionUser!.username ?? "Someone"} mentioned you in a comment`,mentions,targetType,targetId],
        );
      }
      await client.query("commit");
    } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
    finally { client.release(); }
    res.status(201).json({ id: commentId! });
  } catch (error) { next(error); }
});

router.delete("/social/comments/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Comment id is invalid." }); return; }
  try {
    const result = await pool.query("delete from public.comments where id=$1 and (author_id=$2 or $3=true)", [id,req.sessionUser!.id,req.sessionUser!.is_admin]);
    if (!result.rowCount) { res.status(404).json({ error: "Comment not found or cannot be deleted." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get("/social/reactions/:targetType/:targetId", requireSession, requireApprovedSession, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const targetId = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  if (!TARGET_TYPES.has(targetType) || !targetId || targetId.length > 200) { res.status(400).json({ error: "Reaction target is invalid." }); return; }
  try { res.json((await pool.query(`select r.id,r.target_type,r.target_id,r.user_id,r.emoji,${REACTION_PERSON} as user from public.reactions r join public.profiles p on p.id=r.user_id where r.target_type=$1 and r.target_id=$2`, [targetType,targetId])).rows); }
  catch (error) { next(error); }
});

router.get("/social/reactions/:targetType", requireSession, requireApprovedSession, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const ids = parseTargetIds(req.query.target_ids);
  if (!TARGET_TYPES.has(targetType) || ids.length > 500 || ids.some((id) => id.length > 200)) { res.status(400).json({ error: "Reaction targets are invalid." }); return; }
  if (!ids.length) { res.json([]); return; }
  try { res.json((await pool.query(`select r.id,r.target_type,r.target_id,r.user_id,r.emoji,${REACTION_PERSON} as user from public.reactions r join public.profiles p on p.id=r.user_id where r.target_type=$1 and r.target_id=any($2::text[])`, [targetType,ids])).rows); }
  catch (error) { next(error); }
});

router.put("/social/reactions/:targetType/:targetId", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;
  const targetId = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  const { emoji } = req.body ?? {};
  if (!TARGET_TYPES.has(targetType) || !targetId || targetId.length > 200 || typeof emoji !== "string" || emoji.length < 1 || emoji.length > 32) { res.status(400).json({ error: "Reaction details are invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query("select id from public.reactions where target_type=$1 and target_id=$2 and user_id=$3 and emoji=$4 limit 1 for update", [targetType,targetId,req.sessionUser!.id,emoji]);
    if (current.rowCount) await client.query("delete from public.reactions where id=$1", [current.rows[0].id]);
    else await client.query("insert into public.reactions (target_type,target_id,user_id,emoji) values ($1,$2,$3,$4)", [targetType,targetId,req.sessionUser!.id,emoji]);
    await client.query("commit");
    res.status(204).end();
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
