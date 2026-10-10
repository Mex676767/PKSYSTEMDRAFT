import { pool } from "@workspace/db";
import { logger } from "./logger";

type TemplateValues = { names?: string; name?: string; date: string; site_url: string };

export function fillBirthdayTemplate(template: string, values: TemplateValues): string {
  return template
    .replaceAll("{{names}}", values.names ?? values.name ?? "")
    .replaceAll("{{name}}", values.name ?? values.names ?? "")
    .replaceAll("{{date}}", values.date)
    .replaceAll("{{site_url}}", values.site_url.replace(/\/+$/, ""));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
}

export async function sendBirthdayEmail(options: {
  to: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  subject: string;
  body: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email delivery is not configured. Add RESEND_API_KEY to the API environment.");
  const fromEmail = options.fromEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error("The configured sender email address is invalid.");
  const fromName = options.fromName.trim();
  const from = `${fromName ? `${fromName.replace(/[<>\r\n]/g, "")} ` : ""}<${fromEmail}>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [options.to],
      ...(options.replyTo?.trim() ? { reply_to: options.replyTo.trim() } : {}),
      subject: options.subject,
      text: options.body,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(options.body)}</div>`,
    }),
  });
  if (!response.ok) {
    let detail = `provider returned ${response.status}`;
    try {
      const result: unknown = await response.json();
      if (typeof result === "object" && result && "message" in result && typeof result.message === "string") detail = result.message;
    } catch { /* The provider may return a non-JSON error response. */ }
    throw new Error(`Resend could not send the birthday email: ${detail}`);
  }
}

function localDateTime(date: Date, timeZone: string): { date: string; hour: number; minute: number; monthDay: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    monthDay: `${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

type BirthdayPerson = { id: string; email: string | null; username: string | null };
type EmailSettings = {
  enabled: boolean; personal_enabled: boolean; from_name: string; from_email: string; reply_to: string;
  subject: string; body: string; personal_subject: string; personal_body: string; site_url: string;
  timezone: string; send_hour: number;
};

async function createLog(profileId: string, date: string, kind: "announcement" | "personal"): Promise<boolean> {
  const result = await pool.query(
    `insert into public.birthday_email_log(profile_id,birthday_on,kind,status)
     values($1,$2::date,$3,'sending') on conflict(profile_id,birthday_on,kind) do nothing returning id`,
    [profileId, date, kind],
  );
  return Boolean(result.rowCount);
}

async function finishLog(profileId: string, date: string, kind: "announcement" | "personal", recipients: number, error?: string): Promise<void> {
  await pool.query(
    `update public.birthday_email_log set status=$4,recipients=$5,error=$6
      where profile_id=$1 and birthday_on=$2::date and kind=$3`,
    [profileId, date, kind, error ? "failed" : "sent", recipients, error?.slice(0, 1000) ?? null],
  );
}

async function deliverBirthdayEmails(now: Date): Promise<void> {
  const result = await pool.query<EmailSettings>("select * from public.birthday_email_settings where id=1");
  const settings = result.rows[0];
  if (!settings || (!settings.enabled && !settings.personal_enabled)) return;
  if (!process.env.RESEND_API_KEY) {
    logger.error("Birthday emails are enabled but RESEND_API_KEY is missing.");
    return;
  }
  let local: ReturnType<typeof localDateTime>;
  try { local = localDateTime(now, settings.timezone || "UTC"); }
  catch (error) { logger.error({ err: error, timezone: settings.timezone }, "Birthday email timezone is invalid"); return; }
  if (local.hour !== Number(settings.send_hour) || local.minute !== 0) return;

  const birthdays = await pool.query<BirthdayPerson>(
    `select p.id,p.email,p.username
       from public.profiles p
       join public.account_approvals a on a.user_id=p.id and a.approved_at is not null
      where p.birthday is not null and to_char(p.birthday,'MM-DD')=$1
        and p.is_deleted=false and p.is_hidden=false
      order by p.id`,
    [local.monthDay],
  );
  const people = birthdays.rows;
  if (!people.length) return;
  const dateLabel = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: settings.timezone || "UTC" }).format(now);
  const names = people.map((person) => `@${person.username || "teammate"}`).join(", ");
  const siteUrl = settings.site_url || "";

  if (settings.personal_enabled) {
    for (const person of people) {
      if (!person.email || !(await createLog(person.id, local.date, "personal"))) continue;
      try {
        await sendBirthdayEmail({
          to: person.email, fromName: settings.from_name, fromEmail: settings.from_email, replyTo: settings.reply_to,
          subject: fillBirthdayTemplate(settings.personal_subject, { name: `@${person.username || "teammate"}`, date: dateLabel, site_url: siteUrl }),
          body: fillBirthdayTemplate(settings.personal_body, { name: `@${person.username || "teammate"}`, date: dateLabel, site_url: siteUrl }),
        });
        await finishLog(person.id, local.date, "personal", 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email provider request failed.";
        await finishLog(person.id, local.date, "personal", 0, message);
        logger.error({ err: error, profileId: person.id }, "Birthday person email failed");
      }
    }
  }

  if (settings.enabled) {
    const anchor = people[0];
    if (anchor && await createLog(anchor.id, local.date, "announcement")) {
      const recipients = await pool.query<BirthdayPerson>(
        `select p.id,p.email,p.username from public.profiles p
          join public.account_approvals a on a.user_id=p.id and a.approved_at is not null
         where p.email is not null and p.email<>'' and p.is_deleted=false and p.is_hidden=false
           and ($2::boolean=false or not (to_char(p.birthday,'MM-DD')=$1))
         order by p.id`,
        [local.monthDay, settings.personal_enabled],
      );
      let sent = 0;
      const errors: string[] = [];
      for (const recipient of recipients.rows) {
        if (!recipient.email) continue;
        try {
          await sendBirthdayEmail({
            to: recipient.email, fromName: settings.from_name, fromEmail: settings.from_email, replyTo: settings.reply_to,
            subject: fillBirthdayTemplate(settings.subject, { names, date: dateLabel, site_url: siteUrl }),
            body: fillBirthdayTemplate(settings.body, { names, date: dateLabel, site_url: siteUrl }),
          });
          sent++;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Email provider request failed.");
        }
      }
      await finishLog(anchor.id, local.date, "announcement", sent, errors.length ? errors.slice(0, 3).join("; ") : undefined);
    }
  }
}

let lastLocalSlot = "";

/** Checks the saved tenant-local send time, with a cross-replica PostgreSQL lock. */
export async function runBirthdayEmails(now = new Date()): Promise<void> {
  const settings = await pool.query<{ timezone: string; send_hour: number }>("select timezone,send_hour from public.birthday_email_settings where id=1");
  const config = settings.rows[0];
  if (!config) return;
  let local: ReturnType<typeof localDateTime>;
  try { local = localDateTime(now, config.timezone || "UTC"); }
  catch (error) { logger.error({ err: error, timezone: config.timezone }, "Birthday email timezone is invalid"); return; }
  if (local.hour !== Number(config.send_hour) || local.minute !== 0) return;
  const slot = `${local.date}-${local.hour}`;
  if (lastLocalSlot === slot) return;
  lastLocalSlot = slot;
  const client = await pool.connect();
  let locked = false;
  try {
    const result = await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1),1) as locked", ["employee-hub:birthday-emails"]);
    locked = result.rows[0]?.locked === true;
    if (locked) await deliverBirthdayEmails(now);
  } catch (error) {
    logger.error({ err: error, slot }, "Scheduled birthday emails failed");
  } finally {
    if (locked) await client.query("select pg_advisory_unlock(hashtext($1),1)", ["employee-hub:birthday-emails"]).catch(() => undefined);
    client.release();
  }
}
