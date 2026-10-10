import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const admin=(req:any)=>Boolean(req.sessionUser?.is_admin);
router.get("/birthday-email/settings",requireSession,requireApprovedSession,async(req,res,next)=>{
  if(!admin(req)){res.status(403).json({error:"Admin access required."});return;}
  try{const q=await pool.query("select * from public.birthday_email_settings where id=1");res.json(q.rows[0]??null);}catch(e){next(e);}
});
router.patch("/birthday-email/settings",requireSession,requireApprovedSession,assertAllowedBrowserOrigin,async(req,res,next)=>{
  if(!admin(req)){res.status(403).json({error:"Admin access required."});return;}
  const allowed=new Set(["enabled","from_name","from_email","reply_to","subject","body","personal_enabled","personal_subject","personal_body","site_url","send_hour","timezone"]);
  const entries=Object.entries(req.body??{}).filter(([key])=>allowed.has(key));
  if(entries.length===0||entries.length!==Object.keys(req.body??{}).length){res.status(400).json({error:"Email settings are invalid."});return;}
  if(entries.some(([key,value])=>typeof value==="string"&&value.length>5000)||entries.some(([key,value])=>key==="send_hour"&&(!Number.isInteger(value)||Number(value)<0||Number(value)>23))){res.status(400).json({error:"Email settings are invalid."});return;}
  try{const fields=entries.map(([key],i)=>`\"${key}\"=$${i+1}`).join(",");const values=entries.map(([,value])=>value);const q=await pool.query(`update public.birthday_email_settings set ${fields},updated_at=now() where id=1 returning *`,values);if(!q.rowCount){res.status(404).json({error:"Email settings are not initialized."});return;}res.json(q.rows[0]);}catch(e){next(e);}
});
router.get("/birthday-email/log",requireSession,requireApprovedSession,async(req,res,next)=>{
  if(!admin(req)){res.status(403).json({error:"Admin access required."});return;}
  try{const q=await pool.query(`select l.id,l.birthday_on,l.kind,l.status,l.recipients,l.error,l.created_at,jsonb_build_object('username',p.username) as person from public.birthday_email_log l left join public.profiles p on p.id=l.profile_id order by l.created_at desc limit 12`);res.json(q.rows);}catch(e){next(e);}
});
router.post("/birthday-email/test",requireSession,requireApprovedSession,assertAllowedBrowserOrigin,async(req,res)=>{
  if(!admin(req)){res.status(403).json({error:"Admin access required."});return;}
  if(!["announcement","personal"].includes(req.body?.kind)){res.status(400).json({error:"Email type is invalid."});return;}
  res.status(503).json({error:"Email delivery is not configured yet. Resend setup is still needed."});
});
export default router;
