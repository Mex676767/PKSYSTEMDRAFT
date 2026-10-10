# DigitalOcean PostgreSQL baseline

`lib/db/digitalocean-baseline.sql` is generated from the checked-in application schema, the later learning/gratitude, PK v3.43, and team Hall of Fame migrations, plus the API-owned schema migrations. The builder removes the Supabase Auth foreign key, hosted push/birthday delivery functions, storage policies, hosted realtime setup, Supabase-only default grants, and hosted cron scheduling. It keeps the SQL authorization rules used by PK; the tenant API supplies a validated transaction-local user ID when invoking those functions.

## Applied state (2026-10-10)

The baseline has been restored into the isolated `employee_hub_c9` and
`employee_hub_c6` databases on the existing Droplet. Both tenant APIs report
ready over HTTPS. Public application rows, Google identity subjects, legacy
bcrypt password identities, account approvals, and Storage objects have been
imported for each tenant. Do not rerun the initial baseline restore or import
scripts against these populated databases; those scripts are for a fresh empty
target only. Both production Workers now proxy application API traffic to their matching DigitalOcean tenant APIs.

A read-only destination audit on 2026-10-10 confirmed 62 C9 profiles with 62
approval rows, 8 password credentials, and 54 Google identity records; C6 has
56 profiles with 56 approval rows, 0 password credentials, and 56 Google
identity records. Neither tenant has profiles missing approval rows, Hall of
Fame leaders missing profiles, or team members missing profiles. A real C9
password login also succeeded after production cutover. These checks verify
destination state; they are not a substitute for the remaining product-level
PK, Google identity, push, and voice acceptance checks.

## Fresh-target restore procedure

The following steps describe initial provisioning for a fresh target only.
They are not a repair or update procedure for the populated production
databases.

1. Create two new, empty PostgreSQL databases, `employee_hub_c9` and `employee_hub_c6`, on the existing Droplet. Keep the databases private on the server.
2. Create a separate database owner/login for each tenant. Use the matching tenant owner only in that tenant's API process. The owner credential must stay on the Droplet and must never be put in browser configuration or chat.
3. Run `scripts/digitalocean-schema-preamble.sql` as the PostgreSQL administrator in each database. It creates the no-login roles referenced by the captured policies, installs `pgcrypto` for legacy bcrypt login verification, and creates a local `auth.uid()` compatibility function backed by a transaction-local API identity; it does not contact a hosted auth service.
4. Run `scripts/assemble-digitalocean-baseline.ps1` to regenerate the combined baseline after any source migration changes.
5. Restore `lib/db/digitalocean-baseline.sql` into each empty database while connected as that tenant's database owner. Do not point it at a live Supabase project or an existing database.

The API's PostgreSQL credentials grant access to the full tenant database, so keep the database bound to loopback/private networking and expose only the API. Application authorization remains in the authenticated API routes and PK database functions. The production restore has been applied to both tenant databases on the Droplet. The procedure above is only for a fresh empty target; it is not an update procedure.

## Contents and exclusions

- Captured public application schema, constraints, indexes, and triggers.
- PK v3.43 rules, learning and gratitude tables, and team Hall of Fame support.
- API sessions, mood check-ins, app presence, push delivery queue, and voice signaling tables.
- No source employee data, Auth password hashes, or Supabase Storage objects; those require independent tenant exports and import checks.
- The server migration scripts `scripts/digitalocean-import-tenant.sh` and `scripts/digitalocean-copy-tenant-storage.sh` copy public rows, Google identity subjects, legacy bcrypt hashes, and the local `post-images` files into an empty matching tenant target. They do not print hashes or object names and refuse to import into a target that already has profile/identity rows.
- No hosted realtime, object storage, email provider, VAPID secret, or TURN secret. Scheduled DB work runs in the tenant API process; email remains disabled until Resend is configured.
