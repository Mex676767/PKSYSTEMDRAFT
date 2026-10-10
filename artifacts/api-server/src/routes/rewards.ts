import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isAdmin = (req: Parameters<Parameters<typeof router.get>[1]>[0]) => Boolean(req.sessionUser?.is_admin);
const run = (handler: (req: any, res: any, next: any) => Promise<void>) => [requireSession, requireApprovedSession, handler] as const;

router.get("/points/settings", ...run(async (_req, res, next) => {
  try { const q = await pool.query("select revamp_enabled, timezone from public.points_settings where id=1"); res.json(q.rows[0] ?? { revamp_enabled: false, timezone: "Asia/Kuala_Lumpur" }); }
  catch (e) { next(e); }
}));

router.patch("/points/settings", assertAllowedBrowserOrigin, ...run(async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access required." }); return; }
  if (typeof req.body?.revamp_enabled !== "boolean") { res.status(400).json({ error: "Settings are invalid." }); return; }
  try { await pool.query("update public.points_settings set revamp_enabled=$1,updated_at=now() where id=1", [req.body.revamp_enabled]); res.status(204).end(); }
  catch (e) { next(e); }
}));

router.get("/points/missions/me", ...run(async (req, res, next) => {
  try {
    const q = await pool.query(
      `select m.id,m.title,m.description,m.cadence,m.kind,m.target_count,m.points,m.starts_at,m.ends_at,
              least(public.mission_progress($1,m.kind,w.win_start,w.win_end,s.timezone),m.target_count) as progress,
              c.status as claim_status,case when m.cadence='special' then m.ends_at else w.win_end end as resets_at
         from public.points_settings s cross join public.missions m
         cross join lateral public.mission_window(m.cadence,m.starts_at,m.ends_at,s.timezone) w
         left join public.mission_claims c on c.mission_id=m.id and c.user_id=$1 and c.period_start=w.period_start
        where s.id=1 and s.revamp_enabled and m.active
          and (m.cadence<>'special' or ((m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())))
        order by array_position(array['daily','weekly','monthly','special'],m.cadence),m.created_at`,
      [req.sessionUser!.id],
    );
    res.json(q.rows);
  }
  catch (e) { next(e); }
}));

router.get("/points/missions", ...run(async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access required." }); return; }
  try { const q = await pool.query("select * from public.missions order by created_at"); res.json(q.rows); }
  catch (e) { next(e); }
}));

router.post("/points/missions", assertAllowedBrowserOrigin, ...run(async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access required." }); return; }
  const b = req.body ?? {};
  if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 120 || !["daily","weekly","monthly","special"].includes(b.cadence) || typeof b.kind !== "string" || b.kind.length > 40 || !Number.isInteger(b.target_count) || b.target_count < 1 || !Number.isInteger(b.points) || b.points < 1 || typeof b.active !== "boolean") { res.status(400).json({ error: "Mission details are invalid." }); return; }
  try {
    const vals = [b.title.trim(),typeof b.description === "string" ? b.description : null,b.cadence,b.kind,b.target_count,b.points,b.starts_at ?? null,b.ends_at ?? null,b.active,req.sessionUser!.id];
    const q = isUuid(b.id)
      ? await pool.query("update public.missions set title=$1,description=$2,cadence=$3,kind=$4,target_count=$5,points=$6,starts_at=$7,ends_at=$8,active=$9 where id=$10 returning *", [...vals.slice(0,9),b.id])
      : await pool.query("insert into public.missions(title,description,cadence,kind,target_count,points,starts_at,ends_at,active,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *", vals);
    if (!q.rowCount) { res.status(404).json({ error: "Mission not found." }); return; }
    res.status(isUuid(b.id) ? 200 : 201).json(q.rows[0]);
  } catch (e) { next(e); }
}));

router.delete("/points/missions/:id", assertAllowedBrowserOrigin, ...run(async (req, res, next) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin access required." }); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Mission id is invalid." }); return; }
  try { const q = await pool.query("delete from public.missions where id=$1", [id]); if (!q.rowCount) { res.status(404).json({ error: "Mission not found." }); return; } res.status(204).end(); }
  catch (e) { next(e); }
}));

router.post("/points/missions/:id/claim", assertAllowedBrowserOrigin, ...run(async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "Mission id is invalid." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const m = (await client.query("select * from public.missions where id=$1 and active for update", [id])).rows[0];
    const s = (await client.query("select revamp_enabled,timezone from public.points_settings where id=1")).rows[0];
    if (!m || !s?.revamp_enabled) { await client.query("rollback"); res.status(400).json({ error: "Mission is unavailable." }); return; }
    const w = (await client.query("select * from public.mission_window($1,$2,$3,$4)", [m.cadence,m.starts_at,m.ends_at,s.timezone])).rows[0];
    if (!w || Date.now() < new Date(w.win_start).getTime() || Date.now() >= new Date(w.win_end).getTime()) { await client.query("rollback"); res.status(400).json({ error: "Mission is not running." }); return; }
    let status: "awarded" | "pending" = "awarded";
    if (m.kind === "manual") {
      status = "pending";
      const q = await client.query(`insert into public.mission_claims(mission_id,user_id,period_start,status,points) values($1,$2,$3,'pending',$4)
        on conflict(mission_id,user_id,period_start) do update set status='pending',created_at=now(),reviewed_by=null,reviewed_at=null where public.mission_claims.status='rejected' returning id`, [id,req.sessionUser!.id,w.period_start,m.points]);
      if (!q.rowCount) { await client.query("rollback"); res.status(409).json({ error: "Mission was already submitted." }); return; }
    } else {
      const progress = Number((await client.query("select public.mission_progress($1,$2,$3,$4,$5) as progress", [req.sessionUser!.id,m.kind,w.win_start,w.win_end,s.timezone])).rows[0]?.progress ?? 0);
      if (progress < m.target_count) { await client.query("rollback"); res.status(400).json({ error: "Mission is not complete yet." }); return; }
      const q = await client.query("insert into public.mission_claims(mission_id,user_id,period_start,status,points) values($1,$2,$3,'awarded',$4) on conflict(mission_id,user_id,period_start) do nothing returning id", [id,req.sessionUser!.id,w.period_start,m.points]);
      if (!q.rowCount) { await client.query("rollback"); res.status(409).json({ error: "Mission was already claimed." }); return; }
      await client.query("select set_config('app.points_allowed','on',true),set_config('app.skip_points_notify','on',true)");
      await client.query("insert into public.point_transactions(user_id,amount,reason) values($1,$2,$3)", [req.sessionUser!.id,m.points,`Mission: ${m.title}`]);
      await client.query("select set_config('app.points_allowed','off',true),set_config('app.skip_points_notify','off',true)");
      await client.query("insert into public.notifications(user_id,type,target_type,target_id,message) values($1,'points','rewards',$2,$3)", [req.sessionUser!.id,id,`Mission complete: ${m.title} · +${m.points} pts`]);
    }
    await client.query("commit"); res.json(status);
  } catch (e) { await client.query("rollback").catch(() => undefined); next(e); }
  finally { client.release(); }
}));

router.get("/rewards", ...run(async (_req, res, next) => { try { const q=await pool.query("select * from public.rewards order by cost"); res.json(q.rows); } catch(e){next(e);} }));
router.get("/rewards/redemptions/me", ...run(async (req,res,next)=>{ try{const q=await pool.query("select * from public.reward_redemptions where user_id=$1 order by created_at desc limit 50",[req.sessionUser!.id]);res.json(q.rows);}catch(e){next(e);} }));
router.get("/rewards/redemptions", ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}try{const q=await pool.query("select d.*,jsonb_build_object('username',p.username) as \"user\" from public.reward_redemptions d left join public.profiles p on p.id=d.user_id order by d.created_at desc limit 100");res.json(q.rows);}catch(e){next(e);} }));
router.get("/points/mission-claims/pending", ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}try{const q=await pool.query("select c.id,c.points,c.created_at,jsonb_build_object('title',m.title) as mission,jsonb_build_object('username',p.username) as \"user\" from public.mission_claims c left join public.missions m on m.id=c.mission_id left join public.profiles p on p.id=c.user_id where c.status='pending' order by c.created_at");res.json(q.rows);}catch(e){next(e);} }));
router.get("/points/history/full", ...run(async (req,res,next)=>{try{const q=await pool.query("select id,amount,reason,created_at from public.point_transactions where user_id=$1 order by created_at desc limit 100",[req.sessionUser!.id]);res.json(q.rows);}catch(e){next(e);} }));

router.post("/rewards", assertAllowedBrowserOrigin, ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}const b=req.body??{};if(typeof b.name!=="string"||!b.name.trim()||!Number.isInteger(b.cost)||b.cost<1||(b.stock!==null&&b.stock!==undefined&&(!Number.isInteger(b.stock)||b.stock<0))||typeof b.active!=="boolean"){res.status(400).json({error:"Reward details are invalid."});return;}try{const vals=[b.name.trim(),typeof b.description==="string"?b.description:null,b.cost,b.stock??null,b.active];const q=isUuid(b.id)?await pool.query("update public.rewards set name=$1,description=$2,cost=$3,stock=$4,active=$5 where id=$6 returning *",[...vals,b.id]):await pool.query("insert into public.rewards(name,description,cost,stock,active) values($1,$2,$3,$4,$5) returning *",vals);if(!q.rowCount){res.status(404).json({error:"Reward not found."});return;}res.status(isUuid(b.id)?200:201).json(q.rows[0]);}catch(e){next(e);}}));
router.delete("/rewards/:id", assertAllowedBrowserOrigin, ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;if(!isUuid(id)){res.status(400).json({error:"Reward id is invalid."});return;}try{const q=await pool.query("delete from public.rewards where id=$1",[id]);if(!q.rowCount){res.status(404).json({error:"Reward not found."});return;}res.status(204).end();}catch(e){next(e);}}));
router.post("/rewards/:id/redeem", assertAllowedBrowserOrigin, ...run(async (req,res,next)=>{const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;if(!isUuid(id)){res.status(400).json({error:"Reward id is invalid."});return;}const client=await pool.connect();try{await client.query("begin");const settings=(await client.query("select revamp_enabled from public.points_settings where id=1")).rows[0];const reward=(await client.query("select * from public.rewards where id=$1 and active for update",[id])).rows[0];if(!settings?.revamp_enabled||!reward){await client.query("rollback");res.status(400).json({error:"Reward is unavailable."});return;}if(reward.stock!==null){const stock=await client.query("update public.rewards set stock=stock-1 where id=$1 and stock>0 returning id",[id]);if(!stock.rowCount){await client.query("rollback");res.status(409).json({error:"Reward is out of stock."});return;}}const profile=(await client.query("select points from public.profiles where id=$1 for update",[req.sessionUser!.id])).rows[0];if(!profile||profile.points<reward.cost){await client.query("rollback");res.status(400).json({error:"Not enough points."});return;}await client.query("select set_config('app.points_allowed','on',true),set_config('app.skip_points_notify','on',true)");await client.query("insert into public.point_transactions(user_id,amount,reason) values($1,$2,$3)",[req.sessionUser!.id,-reward.cost,`Reward: ${reward.name}`]);await client.query("select set_config('app.points_allowed','off',true),set_config('app.skip_points_notify','off',true)");const redemption=(await client.query("insert into public.reward_redemptions(reward_id,reward_name,user_id,cost) values($1,$2,$3,$4) returning id",[id,reward.name,req.sessionUser!.id,reward.cost])).rows[0];await client.query("insert into public.notifications(user_id,actor_id,type,target_type,target_id,message) select id,$1,'points','admin',$2,$3 from public.profiles where is_admin and not is_deleted",[req.sessionUser!.id,redemption.id,`${req.sessionUser!.username?`@${req.sessionUser!.username}`:"Someone"} redeemed \"${reward.name}\" · needs approval`]);await client.query("commit");res.status(201).json({id:redemption.id});}catch(e){await client.query("rollback").catch(()=>undefined);next(e);}finally{client.release();}}));

router.post("/rewards/redemptions/:id/review", assertAllowedBrowserOrigin, ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;const {approve,note}=req.body??{};if(!isUuid(id)||typeof approve!=="boolean"||(note!==undefined&&note!==null&&typeof note!=="string")){res.status(400).json({error:"Review details are invalid."});return;}const client=await pool.connect();try{await client.query("begin");const d=(await client.query("select * from public.reward_redemptions where id=$1 and status='pending' for update",[id])).rows[0];if(!d){await client.query("rollback");res.status(404).json({error:"Redemption is no longer pending."});return;}const clean=typeof note==="string"?note.trim().slice(0,500):"";await client.query("update public.reward_redemptions set status=$2,admin_note=$3,reviewed_by=$4,reviewed_at=now() where id=$1",[id,approve?"fulfilled":"rejected",clean||null,req.sessionUser!.id]);if(!approve){await client.query("select set_config('app.points_allowed','on',true),set_config('app.skip_points_notify','on',true)");await client.query("insert into public.point_transactions(user_id,amount,reason) values($1,$2,$3)",[d.user_id,d.cost,`Refund: ${d.reward_name}`]);await client.query("select set_config('app.points_allowed','off',true),set_config('app.skip_points_notify','off',true)");if(d.reward_id)await client.query("update public.rewards set stock=stock+1 where id=$1 and stock is not null",[d.reward_id]);}await client.query("insert into public.notifications(user_id,actor_id,type,target_type,target_id,message) values($1,$2,'points','rewards',$3,$4)",[d.user_id,req.sessionUser!.id,id,`Your reward \"${d.reward_name}\" was ${approve?"approved 🎁":"declined · "+d.cost+" pts refunded"}${clean?" · "+clean:""}`]);await client.query("commit");res.status(204).end();}catch(e){await client.query("rollback").catch(()=>undefined);next(e);}finally{client.release();}}));

router.post("/points/mission-claims/:id/review", assertAllowedBrowserOrigin, ...run(async (req,res,next)=>{if(!isAdmin(req)){res.status(403).json({error:"Admin access required."});return;}const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;const approve=req.body?.approve;if(!isUuid(id)||typeof approve!=="boolean"){res.status(400).json({error:"Review details are invalid."});return;}const client=await pool.connect();try{await client.query("begin");const c=(await client.query("select mc.*,m.title from public.mission_claims mc left join public.missions m on m.id=mc.mission_id where mc.id=$1 and mc.status='pending' for update",[id])).rows[0];if(!c){await client.query("rollback");res.status(404).json({error:"Mission claim is no longer pending."});return;}await client.query("update public.mission_claims set status=$2,reviewed_by=$3,reviewed_at=now() where id=$1",[id,approve?"awarded":"rejected",req.sessionUser!.id]);if(approve){await client.query("select set_config('app.points_allowed','on',true),set_config('app.skip_points_notify','on',true)");await client.query("insert into public.point_transactions(user_id,amount,reason) values($1,$2,$3)",[c.user_id,c.points,`Mission: ${c.title??"mission"}`]);await client.query("select set_config('app.points_allowed','off',true),set_config('app.skip_points_notify','off',true)");}await client.query("insert into public.notifications(user_id,actor_id,type,target_type,target_id,message) values($1,$2,'points','rewards',$3,$4)",[c.user_id,req.sessionUser!.id,c.mission_id,approve?`Mission approved: ${c.title??"mission"} · +${c.points} pts`:`Mission not approved: ${c.title??"mission"}. You can submit it again.`]);await client.query("commit");res.status(204).end();}catch(e){await client.query("rollback").catch(()=>undefined);next(e);}finally{client.release();}}));

export default router;
