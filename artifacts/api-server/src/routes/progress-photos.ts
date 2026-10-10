import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const validType=(v:string)=>v==="goal"||v==="challenge";

router.get("/progress-photos/:targetType/:targetId",requireSession,requireApprovedSession,async(req,res,next)=>{
  const targetType=Array.isArray(req.params.targetType)?req.params.targetType[0]:req.params.targetType;const targetId=Array.isArray(req.params.targetId)?req.params.targetId[0]:req.params.targetId;
  if(!validType(targetType)||!isUuid(targetId)){res.status(400).json({error:"Photo target is invalid."});return;}
  try{const q=await pool.query(`select f.id,f.target_type,f.target_id,f.uploader_id,f.image_path,f.caption,f.created_at,jsonb_build_object('username',p.username) as uploader from public.progress_photos f join public.profiles p on p.id=f.uploader_id where f.target_type=$1 and f.target_id=$2 order by f.created_at asc`,[targetType,targetId]);res.json(q.rows);}catch(e){next(e);}
});

router.post("/progress-photos/:targetType/:targetId",requireSession,requireApprovedSession,assertAllowedBrowserOrigin,async(req,res,next)=>{
  const targetType=Array.isArray(req.params.targetType)?req.params.targetType[0]:req.params.targetType;const targetId=Array.isArray(req.params.targetId)?req.params.targetId[0]:req.params.targetId;const {image_path:imagePath,caption}=req.body??{};const uid=req.sessionUser!.id;
  if(!validType(targetType)||!isUuid(targetId)||typeof imagePath!=="string"||imagePath.length>500||!imagePath.startsWith(`${uid}/`)||(caption!==undefined&&caption!==null&&(typeof caption!=="string"||caption.length>500))){res.status(400).json({error:"Progress photo details are invalid."});return;}
  try{
    const allowed=targetType==="goal"
      ? await pool.query("select 1 from public.goals where id=$1 and owner_id=$2",[targetId,uid])
      : await pool.query("select 1 from public.challenges where id=$1 and (creator_id=$2 or opponent_id=$2)",[targetId,uid]);
    if(!allowed.rowCount){res.status(403).json({error:"You cannot add a photo to this goal or challenge."});return;}
    const q=await pool.query("insert into public.progress_photos(target_type,target_id,uploader_id,image_path,caption) values($1,$2,$3,$4,$5) returning id",[targetType,targetId,uid,imagePath,typeof caption==="string"?caption.trim()||null:null]);res.status(201).json({id:q.rows[0].id});
  }catch(e){next(e);}
});

router.delete("/progress-photos/:id",requireSession,requireApprovedSession,assertAllowedBrowserOrigin,async(req,res,next)=>{
  const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;if(!isUuid(id)){res.status(400).json({error:"Photo id is invalid."});return;}
  try{const q=await pool.query("delete from public.progress_photos where id=$1 and (uploader_id=$2 or $3=true)",[id,req.sessionUser!.id,req.sessionUser!.is_admin]);if(!q.rowCount){res.status(404).json({error:"Photo not found or cannot be deleted."});return;}res.status(204).end();}catch(e){next(e);}
});

export default router;
