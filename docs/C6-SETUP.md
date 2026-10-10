# C6 Employee Hub deployment

C6 and C9 share the frontend source but use separate tenant APIs and databases.
The C6 frontend is `https://c6.mextest67.workers.dev`; its `/api` routes are
proxied to the C6 DigitalOcean API.

## Current production state (2026-10-10)

- The C6 PostgreSQL baseline and tenant data are deployed on the existing
  DigitalOcean Droplet. Storage import totals are recorded in
  [`DIGITALOCEAN-BASELINE.md`](DIGITALOCEAN-BASELINE.md).
- The C6 API readiness endpoint
  `https://api-c6.165-245-183-45.sslip.io/api/readyz` returns `ready` for C6.
  The public Worker endpoint `https://c6.mextest67.workers.dev/api/readyz`
  also returns `ready` for C6.
- The C6 Worker deployment from `main` succeeded after the migration and the
  live Admin page, including Daily mood check-ins results, loads.
- Browser-side Supabase SDK dependencies and client calls have been removed.
  Keep the old Supabase service available for rollback until C9 and C6 pass
  full acceptance and push/voice checks are complete.
- Resend is intentionally not configured. Password recovery and birthday
  email delivery remain unavailable until the email provider is configured.
- Push/VAPID and TURN secrets and real-browser voice/push acceptance remain
  outstanding.

## GitHub Actions settings

The `Deploy C6 hub to Cloudflare` workflow builds the C6-branded frontend and
deploys the Worker on pushes to `main` and manual dispatch. It skips deployment
until `C6_DO_API_ORIGIN` is set.

In **GitHub → repository Settings → Secrets and variables → Actions**, the
C6 settings are:

**Variables**

- `C6_DO_API_ORIGIN` = `https://api-c6.165-245-183-45.sslip.io`
- `C6_BRAND_NAME` = `C6` (or the desired C6 display name)
- `C6_WORKER_NAME` = `c6` unless the Cloudflare Worker has another name

**Secrets**

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The matching API's `ALLOWED_ORIGINS` must include
`https://c6.mextest67.workers.dev`. The C9 deployment uses its own
`C9_DO_API_ORIGIN` and must never point at the C6 API.

## Google sign-in

The C6 Google OAuth client must allow this exact redirect URI:

`https://c6.mextest67.workers.dev/api/auth/google/callback`

Keep old OAuth callbacks while rollback may still be needed. Do not rotate or
remove OAuth client secrets as part of this deployment.

## Remaining acceptance before Supabase retirement

- Verify C6 password and Google sign-in, session restore/logout, and
  representative employee and admin writes using the C6 tenant only.
- Verify PK transactions and authorization, existing and new file URLs,
  push delivery, and browser voice calls against C6.
- Keep the current Supabase service available until both C6 and C9 pass these
  checks and rollback is no longer needed. The user handles backups separately.
