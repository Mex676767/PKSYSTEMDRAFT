import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter=Router();
const run=(handler:(req:any,res:any,next:any)=>Promise<void>)=>[requireSession,requireApprovedSession,handler] as const;
router.get("/push/public-key",...run(async(_req,res)=>{const publicKey=process.env.VAPID_PUBLIC_KEY?.trim();if(!publicKey){res.status(503).json({error:"Push notifications are not configured."});return;}res.json({publicKey});}));
router.post("/push/subscriptions",assertAllowedBrowserOrigin,...run(async(req,res,next)=>{
  const {endpoint,p256dh,auth,user_agent:userAgent}=req.body??{};
  if(typeof endpoint!=="string"||endpoint.length>2048||!/^https:\/\//.test(endpoint)||typeof p256dh!=="string"||p256dh.length>256||typeof auth!=="string"||auth.length>256||(userAgent!==undefined&&typeof userAgent!=="string")){res.status(400).json({error:"Push subscription is invalid."});return;}
  try{await pool.query(`insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) values($1,$2,$3,$4,$5) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent`,[req.sessionUser!.id,endpoint,p256dh,auth,typeof userAgent==="string"?userAgent.slice(0,300):""]);res.status(204).end();}catch(e){next(e);}
}));
router.delete("/push/subscriptions",assertAllowedBrowserOrigin,...run(async(req,res,next)=>{
  const endpoint=req.body?.endpoint;if(typeof endpoint!=="string"||endpoint.length>2048){res.status(400).json({error:"Push subscription is invalid."});return;}
  try{await pool.query("delete from public.push_subscriptions where user_id=$1 and endpoint=$2",[req.sessionUser!.id,endpoint]);res.status(204).end();}catch(e){next(e);}
}));
export default router;
