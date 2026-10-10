import { pool } from "@workspace/db";
import { sendPush, type VapidKeys } from "./web-push";

const VAPID: VapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? "",
  subject: process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com",
};
const APP_NAME = process.env.APP_NAME?.trim() || "Employee Hub";
const TITLES: Record<string,string>={comment:"New comment",reply:"New reply",reaction:"New reaction",challenge:"Challenge",dm:"New message",birthday:"Birthday 🎂",goal:"Goal completed 🎯",points:"Points earned",achievement:"Achievement unlocked 🏆"};
const TARGET_PATH: Record<string,string>={goal:"goals",birthday:"birthdays",post:"social",hof_record:"guinness-records",challenge:"challenges",pk:"challenges",dm:"messages",profile:"profile",rewards:"rewards",admin:"admin"};

async function deliverBatch() {
  if(!VAPID.publicKey||!VAPID.privateKey)return;
  const client=await pool.connect();
  try{
    await client.query("begin");
    const queued=await client.query("select id,notification_id,attempts from public.app_push_outbox where processed_at is null and next_attempt_at<=now() order by id for update skip locked limit 5");
    for(const item of queued.rows){
      const n=(await client.query("select id,user_id,type,target_type,target_id,message from public.notifications where id=$1",[item.notification_id])).rows[0];
      if(!n){await client.query("update public.app_push_outbox set processed_at=now() where id=$1",[item.id]);continue;}
      const subs=await client.query("select id,endpoint,p256dh,auth from public.push_subscriptions where user_id=$1",[n.user_id]);
      if(!subs.rowCount){await client.query("update public.app_push_outbox set processed_at=now() where id=$1",[item.id]);continue;}
      const target=n.target_type??(n.type==="dm"?"dm":n.type);
      const payload={title:TITLES[n.type]??APP_NAME,body:String(n.message??"").slice(0,300),path:target==="pk"&&n.target_id?`challenges/${n.target_id}`:TARGET_PATH[target]??"",tag:n.id};
      const results=await Promise.allSettled(subs.rows.map((s)=>sendPush({endpoint:s.endpoint,p256dh:s.p256dh,auth:s.auth},payload,VAPID)));
      const gone=subs.rows.filter((_:unknown,index:number)=>{const result=results[index];return result?.status==="fulfilled"&&result.value.gone;});
      if(gone.length)await client.query("delete from public.push_subscriptions where id=any($1::uuid[])",[gone.map((s:any)=>s.id)]);
      const failed=results.some((result)=>result.status==="rejected"||(result.status==="fulfilled"&&!result.value.ok&&!result.value.gone));
      const attempts=Number(item.attempts)+1;
      if(failed&&attempts<6){const delay=Math.min(3600,30*2**attempts);await client.query("update public.app_push_outbox set attempts=$2,next_attempt_at=now()+($3*interval '1 second') where id=$1",[item.id,attempts,delay]);}
      else await client.query("update public.app_push_outbox set attempts=$2,processed_at=now() where id=$1",[item.id,attempts]);
    }
    await client.query("commit");
  }catch(error){await client.query("rollback").catch(()=>undefined);throw error;}
  finally{client.release();}
}

export function startPushDeliveryWorker() {
  if(!VAPID.publicKey||!VAPID.privateKey)return;
  const poll=()=>void deliverBatch().catch((error)=>console.error("Push delivery batch failed",error instanceof Error?error.message:"unknown error"));
  poll();
  const timer=setInterval(poll,5000);
  timer.unref();
}
