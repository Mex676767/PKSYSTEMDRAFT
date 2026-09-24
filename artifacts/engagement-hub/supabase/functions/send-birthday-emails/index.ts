// Sends the birthday emails configured in Admin → Birthday Email. Deploy with
// --no-verify-jwt (see supabase/BIRTHDAY-EMAILS.md); it does its own auth:
//
//   POST {} with header x-cron-secret   -> the hourly run (from pg_cron). Once
//       the configured local hour is reached, emails today's birthday people
//       (personal) and everyone else (announcement), each at most once a day.
//   POST { action: "test", kind } with an admin's Authorization header
//       -> sends that email, filled with sample names, to the admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fillTemplate,
  isBirthdayOn,
  isoDate,
  joinNames,
  localNow,
  prettyDate,
  textToHtml,
} from "../_shared/birthday-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Settings = {
  enabled: boolean;
  personal_enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  subject: string;
  body: string;
  personal_subject: string;
  personal_body: string;
  site_url: string;
  send_hour: number;
  timezone: string;
};

type Email = { to: string; subject: string; text: string };

function timingSafeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sends through Resend in batches of 100. Throws with Resend's own message on failure. */
async function sendEmails(s: Settings, emails: Email[]) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY isn't set on the send-birthday-emails function yet.");
  if (!s.from_email) throw new Error("Set a sender email in Admin → Birthday Email first.");
  const from = s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((e) => ({
      from,
      to: [e.to],
      subject: e.subject,
      text: e.text,
      html: textToHtml(e.text),
      ...(s.reply_to ? { reply_to: s.reply_to } : {}),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let message = detail;
      try {
        message = JSON.parse(detail).message ?? detail;
      } catch {
        // not JSON; keep the raw text
      }
      throw new Error(`Email service error (${res.status}): ${message}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const payload = await req.json().catch(() => ({}));

  const { data: settings, error: settingsError } = await admin.from("birthday_email_settings").select("*").eq("id", 1).maybeSingle();
  if (settingsError || !settings) return json({ error: "Birthday email settings not found. Run migrations 0014 and 0024." }, 500);
  const s = settings as Settings;
  const now = localNow(s.timezone || "Asia/Kuala_Lumpur");
  const siteUrl = s.site_url || "";

  // ------------------------------------------------------------ test send
  if (payload?.action === "test") {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: "Sign in again and retry." }, 401);
    const { data: me } = await admin.from("profiles").select("is_admin, email, username").eq("id", userData.user.id).maybeSingle();
    if (!me?.is_admin) return json({ error: "Only admins can send test emails." }, 403);
    const to = me.email || userData.user.email;
    if (!to) return json({ error: "Your account has no email address." }, 400);

    const personal = payload.kind === "personal";
    const values = personal
      ? { name: `@${me.username ?? "you"}`, date: prettyDate(now), site_url: siteUrl }
      : { names: "@aldo and @max", date: prettyDate(now), site_url: siteUrl };
    try {
      await sendEmails(s, [{
        to,
        subject: `[Test] ${fillTemplate(personal ? s.personal_subject : s.subject, values)}`,
        text: fillTemplate(personal ? s.personal_body : s.body, values),
      }]);
      return json({ sent: true, to });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  // ------------------------------------------------------------ hourly run
  if (!timingSafeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) return json({ error: "Unauthorized" }, 401);
  if (!s.enabled && !s.personal_enabled) return json({ skipped: "Both birthday emails are switched off." });
  if (now.hour < s.send_hour) return json({ skipped: `Waiting until ${s.send_hour}:00 ${s.timezone}.` });
  if (!RESEND_API_KEY || !s.from_email) return json({ skipped: "Email sending isn't configured yet (sender email or RESEND_API_KEY missing)." });

  const today = isoDate(now);
  const { data: profiles, error: pError } = await admin
    .from("profiles")
    .select("id, username, email, birthday, is_deleted")
    .not("email", "is", null);
  if (pError) return json({ error: pError.message }, 500);
  const active = (profiles ?? []).filter((p) => !p.is_deleted && p.email);
  const birthdayPeople = active.filter((p) => p.birthday && isBirthdayOn(p.birthday, now));
  if (birthdayPeople.length === 0) return json({ sent: 0, reason: "No birthdays today." });

  // Failed attempts from earlier today are retried.
  await admin.from("birthday_email_log").delete().eq("birthday_on", today).eq("status", "failed");

  const claim = async (kind: "announcement" | "personal", ids: string[]) => {
    const { data } = await admin
      .from("birthday_email_log")
      .upsert(ids.map((id) => ({ profile_id: id, birthday_on: today, kind })), { onConflict: "profile_id,birthday_on,kind", ignoreDuplicates: true })
      .select("id, profile_id");
    return data ?? [];
  };
  const finish = (rowIds: string[], ok: boolean, recipients: number, error?: string) =>
    admin.from("birthday_email_log").update({ status: ok ? "sent" : "failed", recipients, error: error ?? null }).in("id", rowIds);

  const result = { personal: 0, announcement: 0, errors: [] as string[] };
  const date = prettyDate(now);

  if (s.personal_enabled) {
    for (const row of await claim("personal", birthdayPeople.map((p) => p.id))) {
      const p = birthdayPeople.find((x) => x.id === row.profile_id)!;
      const values = { name: `@${p.username ?? "you"}`, date, site_url: siteUrl };
      try {
        await sendEmails(s, [{ to: p.email, subject: fillTemplate(s.personal_subject, values), text: fillTemplate(s.personal_body, values) }]);
        await finish([row.id], true, 1);
        result.personal++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await finish([row.id], false, 0, msg);
        result.errors.push(msg);
      }
    }
  }

  if (s.enabled) {
    const claimed = await claim("announcement", birthdayPeople.map((p) => p.id));
    if (claimed.length > 0) {
      const celebrated = birthdayPeople.filter((p) => claimed.some((c) => c.profile_id === p.id));
      const values = { names: joinNames(celebrated.map((p) => `@${p.username ?? "a teammate"}`)), date, site_url: siteUrl };
      // With the personal email on, the birthday people get that instead.
      const skip = new Set(s.personal_enabled ? birthdayPeople.map((p) => p.id) : []);
      const recipients = active.filter((p) => !skip.has(p.id));
      const subject = fillTemplate(s.subject, values);
      const text = fillTemplate(s.body, values);
      try {
        await sendEmails(s, recipients.map((p) => ({ to: p.email, subject, text })));
        await finish(claimed.map((c) => c.id), true, recipients.length);
        result.announcement = recipients.length;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await finish(claimed.map((c) => c.id), false, 0, msg);
        result.errors.push(msg);
      }
    }
  }

  return json(result, result.errors.length ? 502 : 200);
});
