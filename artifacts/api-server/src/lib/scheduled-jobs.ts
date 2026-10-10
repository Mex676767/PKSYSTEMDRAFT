import { pool } from "@workspace/db";
import { logger } from "./logger";

type ScheduledJob = {
  name: string;
  minute: number;
  hour?: number;
  sql: string;
};

const jobs: ScheduledJob[] = [
  { name: "birthday-notifications", minute: 5, sql: "select public.notify_todays_birthdays() as affected" },
  { name: "pk-expire-open", minute: 20, sql: "select public.pk_expire_open() as affected" },
  { name: "pk-auto-settle", minute: 40, sql: "select public.pk_auto_settle() as affected" },
  { name: "pk-missed-updates", minute: 50, sql: "select public.pk_check_missed_updates() as affected" },
  { name: "pk-archive-monthly-seasons", minute: 15, hour: 0, sql: "select public.pk_archive_seasons() as affected" },
];

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
const lastRunSlot = new Map<string, string>();

function slotKey(now: Date): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
}

async function runJob(job: ScheduledJob, slot: string): Promise<void> {
  const client = await pool.connect();
  let lockHeld = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtext($1), 1) as locked",
      [`employee-hub:${job.name}`],
    );
    lockHeld = lock.rows[0]?.locked === true;
    if (!lockHeld) return;

    const result = await client.query<{ affected: number }>(job.sql);
    logger.info({ job: job.name, slot, affected: result.rows[0]?.affected ?? null }, "Scheduled job completed");
  } catch (error) {
    logger.error({ err: error, job: job.name, slot }, "Scheduled job failed");
  } finally {
    if (lockHeld) {
      await client.query("select pg_advisory_unlock(hashtext($1), 1)", [`employee-hub:${job.name}`]).catch((error) => {
        logger.error({ err: error, job: job.name }, "Could not release scheduled job lock");
      });
    }
    client.release();
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const slot = slotKey(now);
    const due = jobs.filter((job) =>
      job.minute === now.getUTCMinutes() &&
      (job.hour === undefined || job.hour === now.getUTCHours()) &&
      lastRunSlot.get(job.name) !== slot,
    );
    for (const job of due) {
      lastRunSlot.set(job.name, slot);
      await runJob(job, slot);
    }
  } finally {
    running = false;
  }
}

/** Start tenant-local scheduled work; advisory locks prevent duplicate API replicas. */
export function startScheduledJobs(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), 20_000);
  timer.unref?.();
}
