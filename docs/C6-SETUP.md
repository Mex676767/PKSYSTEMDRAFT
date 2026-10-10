# C6 Employee Hub deployment

C6 and C9 share the frontend source but use separate tenant APIs and databases.
The public frontend remains at `https://c6.mextest67.workers.dev`; its API
requests are intended to proxy to the C6 DigitalOcean API.

## Current migration state

- The C6 DigitalOcean API and PostgreSQL tenant are deployed on the existing
  Droplet. The API readiness endpoint is
  `https://api-c6.165-245-183-45.sslip.io/api/readyz`.
- The C6 production Cloudflare Worker still serves its current frontend. Its
  `/api` proxy has not yet been enabled, so the live app still uses Supabase.
- Production cutover is pending. Keep the existing Supabase project available
  until sign-in and the app's core flows have been checked through the Worker.
- Resend is intentionally unconfigured; password recovery email is not ready.

## GitHub Actions settings

The `Deploy C6 hub to Cloudflare` workflow builds the C6-branded frontend and
deploys the Worker. It runs on pushes to `main` and can also be started manually.
It skips deployment until `C6_DO_API_ORIGIN` is set.

In **GitHub → repository Settings → Secrets and variables → Actions**, configure:

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

Keep the currently configured Supabase callback until the production cutover
has been verified. Do not rotate or remove OAuth client secrets as part of this
deployment.

## Cutover checks

After the Worker is deployed, verify `/api/readyz` through the Worker, password
login, Google sign-in, session restore/logout, and representative employee and
admin writes. Check C6 only against the C6 tenant. Keep the existing Supabase
service intact until both C6 and C9 pass their checks and rollback is no longer
needed. The user handles backups separately.

