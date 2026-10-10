import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";

const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const person = (alias: string) => `jsonb_build_object('username',${alias}.username,'role',${alias}.role,'avatar_url',${alias}.avatar_url,'active_border',${alias}.active_border,'active_accessory',${alias}.active_accessory)`;
const pkSelect = `c.*, coalesce(jsonb_agg(to_jsonb(cp) || jsonb_build_object('profile',${person("p")}) order by cp.side,cp.is_captain desc,p.username) filter (where cp.user_id is not null),'[]'::jsonb) as participants`;

router.get("/pk", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    const result = await pool.query(`select ${pkSelect} from public.challenges c
      left join public.challenge_participants cp on cp.challenge_id=c.id
      left join public.profiles p on p.id=cp.user_id
      where c.pk_version=1 group by c.id order by c.created_at desc`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

router.get("/pk/settings", requireSession, requireApprovedSession, async (_req, res, next) => {
  try { res.json((await pool.query("select * from public.pk_settings where id=1")).rows[0] ?? null); }
  catch (error) { next(error); }
});

router.get("/pk/violations", requireSession, requireApprovedSession, async (req, res, next) => {
  if (!req.sessionUser!.is_admin) { res.status(403).json({ error: "Only admins can view PK violations." }); return; }
  try {
    res.json((await pool.query(`select v.*,jsonb_build_object('username',p.username) as person,jsonb_build_object('topic',c.topic) as challenge
      from public.pk_violations v left join public.profiles p on p.id=v.user_id left join public.challenges c on c.id=v.challenge_id
      order by v.created_at desc limit 100`)).rows);
  } catch (error) { next(error); }
});

router.get("/pk/library", requireSession, requireApprovedSession, async (_req, res, next) => {
  try {
    res.json((await pool.query(`select pb.*,${person("author")} as author,
      jsonb_build_object('id',c.id,'topic',c.topic,'metric',c.metric,'department',c.department,'pk_type',c.pk_type,'format',c.format,'scoring',c.scoring,'direction',c.direction,'settled_at',c.settled_at,'final_score_a',c.final_score_a,'final_score_b',c.final_score_b,'winner_side',c.winner_side,'status',c.status) as challenge
      from public.pk_playbooks pb join public.profiles author on author.id=pb.author_id
      join public.challenges c on c.id=pb.challenge_id where c.status='settled' order by pb.created_at desc`)).rows);
  } catch (error) { next(error); }
});

router.get("/pk/:id", requireSession, requireApprovedSession, async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!isUuid(id)) { res.status(400).json({ error: "PK id is invalid." }); return; }
  try {
    const [pk, events, terms, scores, sides, playbook, debts] = await Promise.all([
      pool.query(`select ${pkSelect} from public.challenges c
        left join public.challenge_participants cp on cp.challenge_id=c.id left join public.profiles p on p.id=cp.user_id
        where c.id=$1 and c.pk_version=1 group by c.id`, [id]),
      pool.query("select * from public.challenge_events where challenge_id=$1 order by created_at desc", [id]),
      pool.query(`select h.*,jsonb_build_object('username',p.username) as actor from public.challenge_terms_history h left join public.profiles p on p.id=h.actor_id where h.challenge_id=$1 order by h.created_at desc`, [id]),
      pool.query(`select s.*,${person("p")} as profile from public.challenge_score_updates s left join public.profiles p on p.id=s.user_id where s.challenge_id=$1 order by s.created_at desc`, [id]),
      pool.query("select side,score from public.pk_side_scores($1)", [id]),
      pool.query("select * from public.pk_playbooks where challenge_id=$1 limit 1", [id]),
      pool.query(`select d.*,jsonb_build_object('username',debtor.username) as debtor,jsonb_build_object('username',creditor.username) as creditor
        from public.pk_money_debts d left join public.profiles debtor on debtor.id=d.debtor_id left join public.profiles creditor on creditor.id=d.creditor_id where d.challenge_id=$1`, [id]),
    ]);
    res.json({ pk: pk.rows[0] ?? null, events: events.rows, terms: terms.rows, scores: scores.rows, sides: sides.rows, playbook: playbook.rows[0] ?? null, debts: debts.rows });
  } catch (error) { next(error); }
});

type RpcSpec = { sql: string; fields: string[]; result?: "scalar" | "rows"; includeUser?: boolean };
const rpc: Record<string, RpcSpec> = {
  pk_side_scores: { sql: "select side,score from public.pk_side_scores($1::uuid)", fields: ["cid"], result: "rows" },
  pk_pending_approvals: { sql: "select coalesce(jsonb_agg(x), '[]'::jsonb) as value from public.pk_pending_approvals() x", fields: [], result: "scalar" },
  pk_leaderboard: { sql: "select * from public.pk_leaderboard($1::date,$2::text)", fields: ["period", "dept"], result: "rows" },
  pk_champions: { sql: "select * from public.pk_champions($1::text)", fields: ["dept"], result: "rows" },
  pk_can_approve: { sql: "select public.pk_can_approve($1::uuid,$2::uuid) as value", fields: ["cid"], result: "scalar", includeUser: true },
  pk_create: { sql: "select public.pk_create($1::jsonb) as value", fields: ["terms"], result: "scalar" },
  pk_respond: { sql: "select public.pk_respond($1::uuid,$2::text,$3::jsonb)", fields: ["cid", "response", "counter"] },
  pk_accept_open: { sql: "select public.pk_accept_open($1::uuid,$2::numeric,$3::numeric)", fields: ["cid", "my_baseline", "my_target"] },
  pk_cancel: { sql: "select public.pk_cancel($1::uuid)", fields: ["cid"] },
  pk_review: { sql: "select public.pk_review($1::uuid,$2::boolean,$3::text)", fields: ["cid", "approve", "note"] },
  pk_delete: { sql: "select public.pk_delete($1::uuid)", fields: ["cid"] },
  pk_update_score: { sql: "select public.pk_update_score($1::uuid,$2::numeric,$3::text,$4::text)", fields: ["cid", "new_value", "proof", "note"] },
  pk_request_settlement: { sql: "select public.pk_request_settlement($1::uuid)", fields: ["cid"] },
  pk_submit_playbook: { sql: "select public.pk_submit_playbook($1::uuid,$2::text,$3::text,$4::text)", fields: ["cid", "extra", "worked", "copy"] },
  pk_submit_upgrade_evidence: { sql: "select public.pk_submit_upgrade_evidence($1::uuid,$2::text)", fields: ["cid", "evidence"] },
  pk_mark_stopped: { sql: "select public.pk_mark_stopped($1::uuid,$2::uuid,$3::text)", fields: ["cid", "participant_id", "note"] },
  pk_dispute_tier: { sql: "select public.pk_dispute_tier($1::uuid,$2::text)", fields: ["cid", "note"] },
  pk_verify: { sql: "select public.pk_verify($1::uuid,$2::text,$3::text,$4::text)", fields: ["cid", "decision", "note", "tiebreak_side"] },
  pk_terminate: { sql: "select public.pk_terminate($1::uuid,$2::text,$3::text)", fields: ["cid", "reason", "note"] },
  pk_update_settings: { sql: "select public.pk_update_settings($1::jsonb)", fields: ["changes"] },
  pk_resolve_violation: { sql: "select public.pk_resolve_violation($1::uuid,$2::text)", fields: ["violation_id", "resolution_note"] },
};

router.post("/pk/rpc/:name", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const spec = rpc[name];
  if (!spec) { res.status(404).json({ error: "PK operation was not found." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.auth_user_id',$1,true)", [req.sessionUser!.id]);
    const body = req.body ?? {};
    const values = spec.fields.map((field) => body[field] ?? null);
    if (spec.includeUser) values.push(req.sessionUser!.id);
    const result = await client.query(spec.sql, values);
    await client.query("commit");
    res.json(spec.result === "rows" ? result.rows : result.rows[0]?.value ?? null);
  } catch (error) { await client.query("rollback").catch(() => undefined); next(error); }
  finally { client.release(); }
});

export default router;
