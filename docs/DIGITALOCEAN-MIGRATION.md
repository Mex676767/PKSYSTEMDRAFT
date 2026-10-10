# Employee Hub DigitalOcean migration

## Migration rule

The target is to remove Supabase from the application completely, including authentication, database access, file storage, realtime, and scheduled functions. New or migrated frontend features must use the DigitalOcean API and PostgreSQL; do not add Supabase fallbacks or a Supabase auth bridge. Keep production routing unchanged until all feature APIs, tenant databases, data, and integrations are ready and verified.

## Repository baseline (2026-10-07)

- Branch `main` is two local commits ahead of `origin/main` (`a223287`, `1a715f6`). Both commits are preserved.
- The worktree already has untracked `.claude/CLAUDE.md`, `alignment-and-birthday-fixes.patch`, and `deliverables/`. They are preserved and have not been staged or changed.
- No tracked or staged diff was present at the start of this migration.
- Frontend source is in `artifacts/engagement-hub`; it is a Vite app currently hosted on Cloudflare Workers. Per the latest direction, keep the existing `workers.dev` frontends for the first migration phase and proxy `/api` to the DigitalOcean API. Moving static frontend hosting onto the Droplet can follow after a domain is available.
- `artifacts/api-server` now has tenant-bound session/authentication and product API routes. The API and frontend changes described below are local implementation only; there is no connected DigitalOcean database/service in this workspace and no production cutover has occurred.
- The repository contains the Supabase schema, seed material, and 57 ordered SQL migrations. No database dump/export was found in the repository. The existing Ubuntu 24.04 Droplet (`165.245.183.45`, 4 vCPU / 8 GB / 160 GB, $56/month) already runs two healthy self-hosted Supabase stacks (C9 and C6, 11 containers each) and Caddy. No new paid resource has been created. User handles backups separately.
- DigitalOcean Web Console provides root access; SSH rejects the existing local key. The Supabase Compose projects are `/opt/employee-hub/c9` and `/opt/employee-hub/c6`. Their database directories persist under each project's `volumes`, and storage containers mount `/var/lib/storage`. Caddy currently proxies `c9.165-245-183-45.sslip.io` to loopback port 8001 and `c6.165-245-183-45.sslip.io` to port 8002. Existing configuration and data have not been changed.
- The new generated DigitalOcean baseline combines the captured application schema, later required feature migrations, and API-owned tables. It now has a preamble that replaces hosted Auth identity lookup and removes hosted delivery/storage/realtime setup. It still needs a real PostgreSQL restore and tenant acceptance review before deployment.

## Supabase dependency inventory

The Supabase client is initialized in `artifacts/engagement-hub/src/lib/supabase.ts`. A source scan found 139 direct Supabase call sites across 32 frontend source files. The app includes 57 migration files and the consolidated schema contains a large body of database functions/RPCs. These are active application dependencies, not just setup artifacts.

| Function | Current use | Migration destination |
| --- | --- | --- |
| Database reads/writes and RPCs | Profile and admin operations; birthdays; activity; bets; challenges/PK; goals; Hall of Fame and Guinness records; learning; gratitude; mentors/org; notifications/DM/social; points/rewards; quiz/Wordle; voice sessions. Mutations often depend on PostgreSQL functions for authorization and multi-step transactions. | Typed API routes and service functions using Drizzle/PostgreSQL transactions. Port business rules and authorization before removing browser access. |
| Login and sessions | Password login, Google OAuth, OTP/email, logout, session restore/listener, account approval, and password changes in `use-auth.tsx` and related UI. | API-managed opaque sessions in secure, HttpOnly, SameSite cookies; OAuth authorization-code flow; one-time password-reset tokens; server-side approval checks. |
| File uploads | Supabase Storage `post-images` used for post images, avatars, progress photos, and PK/playbook images; public URL lookup is in hooks and components. | Validated authenticated file API storing on persistent Droplet disk under `UPLOADS_DIR`; no Spaces add-on. Preserve object keys and rewrite existing object URLs only after a verified transfer. |
| Realtime | Supabase channels power app-wide invalidation, presence, direct-message updates, gratitude wall/inbox, and voice signaling. | Authenticated API polling backed by PostgreSQL. Voice presence/signaling also needs tenant-scoped endpoints and explicit connection lifecycle handling. |
| Edge Functions and scheduled work | `send-birthday-emails`, `send-push`, and `get-turn-credentials`; shared push and birthday-email helpers. | API worker plus tenant-local scheduled jobs on the existing Droplet. Self-host Coturn on the existing Droplet; keep VAPID, TURN, and later email secrets server-side. |

The feature-level source groups include `use-admin`, `use-auth`, `use-pk`, `use-hall-of-fame`, `use-gratitude`, `use-dm`, `use-posts`, `use-progress-photos`, `use-notifications`, and the other feature hooks. This inventory is intentionally a functional map; each call site must be moved and checked as its feature is ported.

The original direct-reference file audit (paths relative to `artifacts/engagement-hub/src`) is:

- **Auth/session:** `components/change-password-card.tsx`, `hooks/use-auth.tsx`, and `hooks/use-quiz.ts` (the quiz also reads the current Supabase user ID).
- **Database/RPC:** `hooks/use-achievements.ts`, `use-admin.ts`, `use-bets.ts`, `use-birthdays.ts`, `use-challenges.ts`, `use-goals.ts`, `use-gratitude.ts`, `use-guinness-records.ts`, `use-hall-of-fame.ts`, `use-learning.ts`, `use-mentors.ts`, `use-notifications.ts`, `use-org-structure.ts`, `use-pk.ts`, `use-points.ts`, `use-posts.ts`, `use-profile-customization.ts`, `use-progress-photos.ts`, `use-quiz.ts`, `use-rewards.ts`, `use-role-department.ts`, `use-social.ts`, `use-voice-channel.ts`, and `use-wordle.ts`.
- **Storage:** `hooks/use-pk.ts`, `use-posts.ts`, `use-profile-customization.ts`, and `use-progress-photos.ts` use the `post-images` bucket.
- **Realtime:** `components/live-data-sync.tsx`, `hooks/use-app-presence.tsx`, `use-dm.ts`, and `use-gratitude.ts` subscribe to Supabase channels. `hooks/use-realtime-invalidate.ts` is also part of the realtime abstraction used by app features and must be checked during the replacement.
- **Edge Functions:** `hooks/use-birthday-email-settings.ts` invokes birthday email delivery; `lib/push.ts` invokes push delivery; `lib/turn-credentials.ts` retrieves TURN credentials.
- **Client setup/configuration:** `lib/supabase.ts`, `lib/brand.ts`, `package.json`, and the Supabase entry in `pnpm-lock.yaml` establish the browser SDK and per-build Supabase URL/key. The configured key is publishable/anon; it is not an admin key, but it must disappear when the browser SDK is removed.

Direct browser SDK feature calls have now been removed. General app invalidation/presence/notification/DM/gratitude, voice presence/signaling, and PK reads/RPCs use tenant API routes. The unused browser SDK, project URL, and publishable key were removed from the frontend source and package manifest. Hosted edge-function source and Supabase SQL history remain as migration/reference material while production still depends on Supabase. The original count of 139 call sites across 32 files is a dated baseline.

## Data and identity risks

- Existing local seeds, exports, or snapshots may be stale. A fresh, timestamped export from each source project is required immediately before the migration rehearsal; compare source and destination counts and representative foreign-key, ownership, and Hall of Fame integrity checks.
- C9 and C6 must use independent API service configurations and independent PostgreSQL databases (separate clusters are also acceptable). Each API process accepts one `APP_TENANT` and one `TENANT_DATABASE_URL`, and validates the database name (`employee_hub_c9` or `employee_hub_c6`) against that tenant. Do not put both tenant database secrets into one runtime. Never copy C9 credentials or data into C6 or vice versa.
- Supabase Auth is separate from the public application schema. A read-only aggregate query against the Droplet found 8 C9 bcrypt password hashes (one at cost 6 and seven at cost 10) and 53 passwordless C9 accounts; all 56 C6 accounts are passwordless. The API now verifies imported bcrypt hashes with PostgreSQL `pgcrypto` and upgrades a successful login to its current scrypt format. OAuth identity transfer and per-tenant account reconciliation remain required.
- The SQL history embeds Supabase `auth.uid()`, RLS policies, `storage.objects`, and Supabase-specific realtime publication logic. These rules must become API authorization/validation and PostgreSQL constraints/transactions; applying those SQL files unchanged to DigitalOcean PostgreSQL will not migrate the application.
- Hall of Fame migration must preserve the current rule: Individual awards can have tied winners side by side; Team awards have one leader with members shown beneath. Migration checks must cover both award types and team membership.
- Data exports, image downloads, counts, and credential-backed source comparisons are blocked until Droplet and both Supabase projects are made accessible through approved secure channels. No credentials should be pasted into chat.
- Read-only query sets are prepared in `scripts/migration-audit-source.sql` and `scripts/migration-audit-target.sql`. Run the source file independently on C9 and C6 immediately before export; run the target file independently on `employee_hub_c9` and `employee_hub_c6` after import. Compare the table-count result sets per tenant and verify the profile/approval, storage, password-hash-format, team-member, and individual-tie checks. The source query reports password hash format/count only, never hash values.

## Local implementation milestones

1. **Foundation (implemented locally):** establish one-tenant-per-API runtime configuration, explicit browser origin allowlist, cookie/session verification, and database readiness probe. Existing Workers keep serving static assets and now have a local `/api` reverse-proxy entrypoint to tenant APIs on DigitalOcean. The GitHub deploy workflows wait until each `C9_DO_API_ORIGIN` / `C6_DO_API_ORIGIN` repository variable is configured.
2. **Hall of Fame API (implemented locally):** transactional award endpoints, permissions, audit snapshots, and validation for tied Individuals and single-leader Teams. The frontend now calls these API routes directly; the DigitalOcean database and API still need deployment and verification.
3. **Auth API (implemented locally and wired in the frontend):** scrypt password storage, legacy bcrypt verification with login-time upgrade, password login/change/recovery, Resend delivery, approval-aware sessions, Google OAuth with PKCE, and verified-email account linking. The frontend now uses the DigitalOcean API for login, session restore, logout, password change/reset, username claims, and daily login streaks. OAuth identities and account approval state still need migration and tenant-specific Google OAuth settings.
4. **Daily mood check-ins (implemented locally):** DigitalOcean PostgreSQL migration, authenticated API writes, and admin-only daily results API. The frontend calls the DigitalOcean API directly. The requested extra daily mood popup still needs product/UI implementation and is not yet part of this migration port.
5. **Additional product API ports (implemented locally and wired directly):** user administration, organization structure, birthdays, achievements, Guinness records, goals, quiz, and Wordle. No Supabase fallback is retained in these features. Each still needs schema/data deployment and verification against both tenants.
6. **Additional product API ports (implemented locally and wired directly):** account activity history, point history/gifts, profile title/border/accessory customization, and avatar URL updates.
7. **Additional product API ports (implemented locally and wired directly):** directory and mentorship management, learning resources/requests/shares, gratitude messages, and notifications. Gratitude, notifications, and app-wide invalidation now refresh through bounded polling instead of Supabase Realtime.
8. **Presence (implemented locally):** API-backed per-tab presence records and active-user listing with polling; new PostgreSQL migration `0003_app_presence.sql`.
9. **Additional product API ports (implemented locally and wired directly):** bets, challenges, and social comments/reactions. These use polling in place of the Supabase realtime subscriptions. Each still needs schema/data deployment and verification against both tenants.
10. **Direct messages (implemented locally):** conversation listing/creation, messages, read receipts, delete authorization, and unread counts now use tenant API routes with polling.
11. **Rewards and missions (implemented locally):** settings, mission progress/claiming, admin mission management/review, reward management/redemption/review, and points history now use tenant API routes.
12. **Post data (implemented locally):** feed, desk setup vote counts, create, and delete now use tenant API routes. New post images use the authenticated Droplet file API.
13. **Droplet file storage (implemented locally):** authenticated uploads for avatars, posts, progress photos, and PK score proof images write validated image files under `UPLOADS_DIR`; downloads use a constrained public API URL. New uploads for these features no longer use Supabase Storage.
14. **Progress photos (implemented locally):** list/add/delete endpoints enforce the same goal-owner, challenge-participant, uploader, and admin checks. The frontend now uses the API and Droplet file storage.
15. **Birthday email settings (implemented locally):** settings/log reads and settings edits use the API. Test sending returns a clear not-configured response until the user sets up Resend, which remains intentionally deferred.
16. **Voice service (implemented locally):** authenticated API presence heartbeats, queued WebRTC offer/answer/ICE delivery, and voice-session start/stop replace the browser's Supabase Realtime and RPC usage. New tables are in `lib/db/migrations/0005_voice_realtime_replacement.sql`; deployment and real-browser verification remain.
17. **PK API (implemented locally):** PK list/detail, approval status, side scores, leaderboards, champions, settings, violations, playbook library, and the currently-used transactional functions now route through the tenant API. Mutating RPCs run inside a transaction with validated, transaction-local user identity so existing PK SQL rules retain their authorization checks. The identity preamble and complete baseline builder are in `scripts/digitalocean-schema-preamble.sql` and `scripts/assemble-digitalocean-baseline.ps1`. No target database has been provisioned or exercised yet.
18. **Browser SDK removal (implemented locally):** the frontend no longer imports the Supabase client, and its SDK and embedded project config were removed. Hosted edge-function source and Supabase migrations remain as legacy migration material pending production cutover.
19. **Scheduled database work (implemented locally):** tenant-bound API processes now run birthday notification creation, PK open expiry, PK auto-settlement, missed-update reminders, and monthly PK season archival without `pg_cron`. PostgreSQL advisory locks prevent duplicate execution if an API tenant has multiple replicas. Birthday email delivery remains deferred until Resend is configured.
20. Push subscription management, a database delivery queue, VAPID delivery worker, and TURN credential proxy are implemented locally but still need schema deployment, secrets, and end-to-end verification. Existing Supabase file objects still need transfer and URL rewriting. Realtime screens now use bounded polling.
21. Prepare fresh isolated C9/C6 exports and repeatable count/integrity reports when source access is available. Test each tenant independently while the existing sites stay live.
22. Present exact production settings and the cutover/rollback checklist for approval. No deployment, production routing change, Supabase shutdown, or deletion is authorized before that approval.

## Remaining production blockers

- A generated portable PostgreSQL baseline and preamble now exist in `lib/db/digitalocean-baseline.sql` and `scripts/digitalocean-schema-preamble.sql`. They have not been applied or validated on the Droplet; see [`DIGITALOCEAN-BASELINE.md`](DIGITALOCEAN-BASELINE.md). The baseline builder is in `scripts/assemble-digitalocean-baseline.ps1`.
- PK and voice API replacements and the generated schema baseline are local only and have not been deployed or exercised with real C9/C6 users.
- The browser SDK is removed from the frontend. Legacy SQL history remains as migration source material; hosted edge-function code remains until production cutover because the current production sites and data still depend on Supabase.
- No standalone target databases have been created. Public app data, OAuth identities, and existing Storage objects have not moved. Legacy bcrypt login support is implemented locally; account data and identity transfer still need a rehearsal.
- The DigitalOcean API is not deployed or connected to the Droplet. VAPID/Coturn and OAuth settings are not configured. The user will handle backups separately.
- The API is not deployed. The existing C9/C6 Supabase containers remain active and serve the current production Workers. Source data and storage objects have not been copied to standalone PostgreSQL and Droplet file storage.
- Phase one keeps the current Cloudflare Workers frontends and proxies `/api` to tenant APIs on the Droplet. Google OAuth callbacks use the matching Worker URL, which then proxies the callback to the API. Moving static frontend hosting to the Droplet remains a later domain-dependent option.

## API runtime settings

Run the separate C9/C6 PostgreSQL and API containers from `deploy/digitalocean/docker-compose.yml`. Each tenant has a private Docker network, database, database owner, API process, and uploads directory. PostgreSQL TLS is enabled; only the API port is published, bound to host loopback behind Caddy. Keep Compose and API secrets in root-readable files under `/etc/employee-hub`; never put them in the repository or browser configuration. Password recovery later needs server-side `RESEND_API_KEY` and `EMAIL_FROM`; Resend is intentionally deferred. Google sign-in uses tenant-specific `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and exact `GOOGLE_REDIRECT_URI`. `/api/healthz` reports the configured tenant; `/api/readyz` checks PostgreSQL connectivity without exposing connection details.

## Production cutover checklist (preparation only)

- [ ] Confirm the current Supabase data sizes and source/target PostgreSQL versions, then install two isolated standalone PostgreSQL targets and tenant API services on the existing Droplet. Root access is available through the DigitalOcean Web Console; the existing SSH key still needs repair for routine deployment.
- [ ] Use separate PostgreSQL databases `employee_hub_c9` and `employee_hub_c6` on the existing Droplet and separate database-owner credentials, one per private tenant API. The current API routes enforce authorization; the owner credentials must stay on loopback/private networking and never be exposed to browser clients.
- [ ] Deploy two tenant API processes and PostgreSQL to the existing Droplet to avoid adding monthly App Platform service charges. Keep PostgreSQL private to the machine/VPC and expose only the HTTPS API origin.
- [ ] During phase one, keep both current Workers as static frontends and proxy `/api` to their matching tenant API. Point `C9_DO_API_ORIGIN` and `C6_DO_API_ORIGIN` to the matching HTTPS API origin and use the existing Worker origins in each API's `ALLOWED_ORIGINS`.
- [ ] Keep the current Worker hostnames for the browser and set each Google OAuth redirect URI to its exact Worker callback URL ending in `/api/auth/google/callback`.
- [ ] Configure tenant-isolated Google OAuth settings and verify both complete PKCE sign-in flows through the Worker proxies.
- [ ] Verify the Resend sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` in each API service’s secret store.
- [ ] Configure persistent Droplet disk paths and capacity limits for the validated file API; transfer Supabase objects and verify each rewritten URL. User handles backups separately.
- [ ] Configure server-side VAPID credentials, Coturn credentials, and any voice/push callbacks per tenant. Scheduled database work runs inside each tenant API process. Email remains deferred until Resend is configured.
- [ ] Rehearse rollback: keep both Supabase projects and existing Worker builds available, record the exact DNS/reverse-proxy changes, restore the previous Worker routing if checks fail, and reconcile any writes made after cutover before retrying. Never dual-write without an explicit consistency design.
- [ ] After independent C9 and C6 acceptance checks, route the Workers to the new APIs, verify login and core writes, then stop the obsolete Supabase application services while retaining the user's separately managed backups.

## Verification so far

- `pnpm run typecheck` passed across the workspace.
- API TypeScript typecheck passed.
- Hall of Fame routes and frontend API helper pass their TypeScript checks.
- API unit tests: 13 passed for password hashing/verification, C9/C6 database binding, OAuth/bridge configuration, and Hall of Fame individual/team rules.
- API production build passed. Engagement Hub production build passed with local `PORT` and `BASE_PATH` values; Vite reported existing sourcemap and large-chunk warnings.
- No live API, tenant database, source export, or remote service was accessed or changed.
