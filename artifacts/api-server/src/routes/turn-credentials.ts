import { Router, type IRouter } from "express";
import { requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter=Router();
router.get("/voice/turn-credentials",requireSession,requireApprovedSession,async(_req,res)=>{
  const keyId=process.env.CLOUDFLARE_TURN_KEY_ID?.trim();const token=process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
  if(!keyId||!token){res.status(503).json({error:"TURN credentials are not configured."});return;}
  try{
    const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({ttl:86400}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok){res.status(502).json({error:"The TURN provider could not issue credentials."});return;}
    const data=await response.json() as {iceServers?:unknown};const iceServers=Array.isArray(data.iceServers)?data.iceServers:data.iceServers?[data.iceServers]:[];
    if(!iceServers.length){res.status(502).json({error:"The TURN provider returned no ICE servers."});return;}
    res.setHeader("Cache-Control","private, no-store");res.json({iceServers});
  }catch{res.status(502).json({error:"TURN credentials could not be retrieved."});}
});
export default router;
