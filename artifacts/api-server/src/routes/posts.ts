import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const postFields = `p.id,p.author_id,p.body,p.image_path,p.category,p.created_at,
  jsonb_build_object('username',u.username,'avatar_url',u.avatar_url,'active_border',u.active_border,'active_accessory',u.active_accessory) as author`;

router.get("/posts", requireSession, requireApprovedSession, async (_req,res,next)=>{
  try{const q=await pool.query(`select ${postFields} from public.posts p join public.profiles u on u.id=p.author_id order by p.created_at desc limit 300`);res.json(q.rows);}catch(e){next(e);}
});

router.get("/posts/desk-setup", requireSession, requireApprovedSession, async (_req,res,next)=>{
  try{const q=await pool.query(`select ${postFields},count(r.id)::int as vote_count from public.posts p join public.profiles u on u.id=p.author_id left join public.reactions r on r.target_type='post' and r.target_id=p.id::text where p.category='desk_setup' group by p.id,u.id order by vote_count desc,p.created_at desc`);res.json(q.rows);}catch(e){next(e);}
});

router.post("/posts", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async(req,res,next)=>{
  const {body,image_path:imagePath,category="general"}=req.body??{};
  if((body!==null&&body!==undefined&&(typeof body!=="string"||body.length>5000))||(imagePath!==null&&imagePath!==undefined&&(typeof imagePath!=="string"||imagePath.length>500))||!["general","desk_setup"].includes(category)){res.status(400).json({error:"Post details are invalid."});return;}
  try{const q=await pool.query(`with inserted as (insert into public.posts(author_id,body,image_path,category) values($1,$2,$3,$4) returning *) select ${postFields} from inserted p join public.profiles u on u.id=p.author_id`,[req.sessionUser!.id,typeof body==="string"&&body.trim()?body.trim():null,imagePath??null,category]);res.status(201).json(q.rows[0]);}catch(e){next(e);}
});

router.delete("/posts/:id", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async(req,res,next)=>{
  const id=Array.isArray(req.params.id)?req.params.id[0]:req.params.id;if(!isUuid(id)){res.status(400).json({error:"Post id is invalid."});return;}
  try{const q=await pool.query("delete from public.posts where id=$1 and (author_id=$2 or $3=true)",[id,req.sessionUser!.id,req.sessionUser!.is_admin]);if(!q.rowCount){res.status(404).json({error:"Post not found or cannot be deleted."});return;}res.status(204).end();}catch(e){next(e);}
});

export default router;
