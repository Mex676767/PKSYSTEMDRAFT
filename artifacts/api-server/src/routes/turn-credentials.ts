import { Router, type IRouter } from "express";
import { requireApprovedSession, requireSession } from "../middleware/session-auth";
import { createTurnRestCredentials } from "../lib/turn-rest";

const router: IRouter=Router();
router.get("/voice/turn-credentials",requireSession,requireApprovedSession,(req,res)=>{
  const secret=process.env.TURN_SHARED_SECRET?.trim();
  const urls=(process.env.TURN_URLS??"").split(",").map((url)=>url.trim()).filter((url)=>/^turns?:[^\s,]+$/i.test(url));
  if(!secret||!urls.length){res.status(503).json({error:"TURN credentials are not configured."});return;}

  // Coturn's TURN REST API accepts time-limited credentials signed with the
  // shared secret. Keep the secret on the API and give clients only a 10-minute
  // credential scoped to their authenticated user ID.
  const {username,credential}=createTurnRestCredentials(req.sessionUser!.id,secret);
  res.setHeader("Cache-Control","private, no-store");
  res.json({iceServers:[{urls,username,credential}]});
});
export default router;
