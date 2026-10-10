import { Router, type IRouter } from "express";
import express from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const root = path.resolve(process.env.UPLOADS_DIR?.trim() || "./data/uploads");
const ownerPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const filePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;
type ImageKind = { mime: string; extension: string; prefix: number[] };
const imageKinds: ImageKind[] = [
  { mime:"image/jpeg", extension:"jpg", prefix:[0xff,0xd8,0xff] },
  { mime:"image/png", extension:"png", prefix:[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a] },
  { mime:"image/gif", extension:"gif", prefix:[0x47,0x49,0x46,0x38] },
  { mime:"image/webp", extension:"webp", prefix:[0x52,0x49,0x46,0x46] },
];

const resolveImage = (owner: string, name: string) => {
  if (!ownerPattern.test(owner) || !filePattern.test(name) || name.includes("..")) return null;
  const file = path.resolve(root, owner, name);
  if (!file.startsWith(`${root}${path.sep}`)) return null;
  return file;
};

router.post("/files/:owner/:name", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, express.raw({ type:"image/*", limit:"10mb" }), async(req,res,next)=>{
  const owner=Array.isArray(req.params.owner)?req.params.owner[0]:req.params.owner;
  const name=Array.isArray(req.params.name)?req.params.name[0]:req.params.name;
  const file=resolveImage(owner,name);
  if(!file){res.status(400).json({error:"File path is invalid."});return;}
  if(owner!==req.sessionUser!.id&&!req.sessionUser!.is_admin){res.status(403).json({error:"You can only upload files to your own profile."});return;}
  if(!Buffer.isBuffer(req.body)||req.body.length<12){res.status(400).json({error:"Image file is empty or invalid."});return;}
  const image=imageKinds.find((kind)=>kind.prefix.every((value,index)=>req.body[index]===value));
  if(!image){res.status(415).json({error:"Upload a JPEG, PNG, GIF, or WebP image."});return;}
  if(image.mime==="image/webp"&&req.body.toString("ascii",8,12)!=="WEBP"){res.status(415).json({error:"WebP image is invalid."});return;}
  try{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,req.body,{flag:"w"});res.status(201).json({path:`${owner}/${name}`,url:`/api/files/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,content_type:image.mime});}
  catch(error){next(error);}
});

router.get("/files/:owner/:name",async(req,res,next)=>{
  const owner=Array.isArray(req.params.owner)?req.params.owner[0]:req.params.owner;
  const name=Array.isArray(req.params.name)?req.params.name[0]:req.params.name;
  const file=resolveImage(owner,name);
  if(!file){res.status(404).end();return;}
  try{
    const contents=await readFile(file);
    const image=imageKinds.find((kind)=>kind.prefix.every((value,index)=>contents[index]===value));
    if(!image||(image.mime==="image/webp"&&contents.toString("ascii",8,12)!=="WEBP")){res.status(404).end();return;}
    res.setHeader("Content-Type",image.mime);res.setHeader("Cache-Control","public, max-age=3600");res.setHeader("X-Content-Type-Options","nosniff");res.send(contents);
  }catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT"){res.status(404).end();return;}next(error);}
});

export default router;
