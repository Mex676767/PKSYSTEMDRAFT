# DigitalOcean PostgreSQL baseline

`lib/db/digitalocean-baseline.sql` is generated from the checked-in application schema, the later learning/gratitude, PK v3.43, and team Hall of Fame migrations, plus the API-owned schema migrations. The builder removes the Supabase Auth foreign key, hosted push/birthday delivery functions, storage policies, hosted realtime setup, Supabase-only default grants, and hosted cron scheduling. It keeps the SQL authorization rules used by PK; the tenant API supplies a validated transaction-local user ID when invoking those functions.

## Build and apply

1. Create two new, empty PostgreSQL databases, `employee_hub_c9` and `employee_hub_c6`, on the existing Droplet. Keep the databases private on the server.
2. Create a separate database owner/login for each tenant. Use the matching tenant owner only in that tenant's API process. The owner credential must stay on the Droplet and must never be put in browser configuration or chat.
3. Run `scripts/digitalocean-schema-preamble.sql` as the PostgreSQL administrator in each database. It creates the no-login roles referenced by the captured policies, installs `pgcrypto` for legacy bcrypt login verification, and creates a local `auth.uid()` compatibility function backed by a transaction-local API identity; it does not contact a hosted auth service.
4. Run `scripts/assemble-digitalocean-baseline.ps1` to regenerate the combined baseline after any source migration changes.
5. Restore `lib/db/digitalocean-baseline.sql` into each empty database while connected as that tenant's database owner. Do not point it at a live Supabase project or an existing database.

The API's PostgreSQL credentials grant access to the full tenant database, so keep the database bound to loopback/private networking and expose only the API. Application authorization remains in the authenticated API routes and PK database functions. This restore plan has not yet been applied or validated against an actual DigitalOcean PostgreSQL server.

## Contents and exclusions

- Captured public application schema, constraints, indexes, and triggers.
- PK v3.43 rules, learning and gratitude tables, and team Hall of Fame support.
- API sessions, mood check-ins, app presence, push delivery queue, and voice signaling tables.
- No source employee data, Auth password hashes, or Supabase Storage objects; those require independent tenant exports and import checks.
- No hosted realtime, object storage, email provider, VAPID secret, or TURN secret. Scheduled DB work runs in the tenant API process; email remains disabled until Resend is configured.
