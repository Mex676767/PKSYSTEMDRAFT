# Employee Hub DigitalOcean migration

## Migration rule

The target is to remove Supabase from the application completely, including authentication, database access, file storage, realtime, and scheduled functions. New or migrated frontend features must use the DigitalOcean API and PostgreSQL; do not add Supabase fallbacks or a Supabase auth bridge. Keep production routing unchanged until all feature APIs, tenant databases, data, and integrations are ready and verified.

## Current status (2026-10-11)

This status reflects production evidence checked on 2026-10-11. It supersedes the historical planning snapshot and rollout checklist below.

- A current source scan found no runtime Supabase SDK imports or client calls in the frontend/API; the only remaining source matches are historical comments. The checked-in runtime is already wired to the DigitalOcean APIs.
- DigitalOcean access is available through the existing account and existing Droplet; no new infrastructure was created. The tenant APIs and PostgreSQL databases run on the Droplet, and both public Worker `/api/readyz` routes returned `ready` on 2026-10-11.
- Separate P-256 VAPID key pairs were generated for C9 and C6 on the Droplet, and the shared Coturn REST secret was installed server-side. Secret-bearing env files have restrictive permissions and no key material was copied into the repository. Both tenant API containers were recreated and returned ready afterward.
- Coturn is running on the Droplet. Host UFW allows TCP/UDP 3478 and UDP 49160–49200; listeners were confirmed. No push subscriptions existed in either tenant database when VAPID was provisioned. Real-browser push and voice acceptance is still outstanding.
- The former self-hosted `c9-supabase-*` and `c6-supabase-*` containers are stopped. Their persistent data has not been deleted. The hosted Supabase projects are still present; they have not been paused or deleted.

- The migration and follow-up fixes were merged into `main` in PRs [#1](https://github.com/Mex676767/PKSYSTEMDRAFT/pull/1), [#2](https://github.com/Mex676767/PKSYSTEMDRAFT/pull/2), [#4](https://github.com/Mex676767/PKSYSTEMDRAFT/pull/4), and [#6](https://github.com/Mex676767/PKSYSTEMDRAFT/pull/6). PR #4 fixes Profile rendering for migrated PostgreSQL birthday timestamps. PR #6 fixes nested legacy Storage URL rewriting and file serving.
- The C9 and C6 GitHub Actions builds and Cloudflare deployments for these merges succeeded. Both Worker `/api/readyz` routes return `ready` and the matching tenant (`C9` or `C6`); the two public DigitalOcean API readiness routes also return ready. The PR #6 nested-file fix was built into the C9/C6 API containers; representative legacy nested images return HTTP 200 with `image/jpeg` from both tenant APIs.
- The two isolated PostgreSQL/API tenant stacks, application data, auth identities, approvals, and Storage objects are deployed on the existing Droplet. The storage import counts recorded for the migration are 122 C9 objects and 60 C6 objects. See `DIGITALOCEAN-BASELINE.md` for the applied state.
- The admin page and Daily mood check-ins results load on both live Workers. The user’s mood response was not submitted as part of this verification. Invalid imported dates no longer crash the page; PostgreSQL date timestamps display as birthdays.
- Fresh authenticated browser loads of the C9 and C6 Profile routes now render successfully after PR #4 deployed. The earlier error was caused by migrated PostgreSQL date values being parsed as date-only strings.
- A previous C9 password sign-in succeeded with the credential supplied at that time, but the user has since corrected the test credential; the corrected password has not been independently verified. The currently open C9 browser session is not proof of a fresh password sign-in. A read-only target audit reports 62 C9 profiles, 62 approval rows, 8 password credentials, and 54 Google identity records; C6 has 56 profiles, 56 approval rows, 0 password credentials, and 56 Google identity records. Neither tenant has profiles missing approval rows, Hall of Fame leaders missing profiles, or team members missing profiles. C9 Google sign-in still needs identity reconciliation: the Google email appeared as a new pending profile. No approval or role change was made. C6’s existing signed-in session reached its Admin page.
- The frontend and production package manifests/lockfile contain no Supabase browser SDK or direct client calls. Worker `/api` requests go to the tenant DigitalOcean APIs. Legacy SQL migrations and edge-function source remain as historical migration material, not application runtime dependencies. A current source and manifest scan found no Supabase SDK imports, project keys, or direct client calls outside that historical folder.
- Resend remains intentionally unconfigured, as requested. VAPID and Coturn are provisioned on the Droplet; real-browser voice/push acceptance remains outstanding.
- The DigitalOcean app runtime has no Supabase SDK/client dependency. Self-hosted Supabase containers are stopped and hosted projects remain present for now; complete tenant acceptance and reconcile post-cutover writes before pausing or deleting those hosted projects. The user handles backups separately.

Next: finish independent C9/C6 core-feature acceptance and reconcile C9’s Google identity through the existing approval workflow. Then pause or retire the hosted Supabase projects after confirming the acceptance/write-reconciliation gate. Resend remains deferred.

## Historical repository baseline (2026-10-07)

- Branch `main` is two local commits ahead of `origin/main` (`a223287`, `1a715f6`). Both commits are preserved.
- The worktree already has untracked `.claude/CLAUDE.md`, `alignment-and-birthday-fixes.patch`, and `deliverables/`. They are preserved and have not been staged or changed.
- No tracked or staged diff was present at the start of this migration.
- Frontend source is in `artifacts/engagement-hub`; it is a Vite app currently hosted on Cloudflare Workers. Per the latest direction, keep the existing `workers.dev` frontends for the first migration phase and proxy `/api` to the DigitalOcean API. Moving static frontend hosting onto the Droplet can follow after a domain is available.
- `artifacts/api-server` now has tenant-bound session/authentication and product API routes. At the time of this 2026-10-07 snapshot, the API and frontend changes were local only; subsequent deployment and cutover status is recorded above.
- The repository contains the Supabase schema, seed material, and 57 ordered SQL migrations. No database dump/export was found in the repository. The existing Ubuntu 24.04 Droplet (`165.245.183.45`, 4 vCPU / 8 GB / 160 GB, $56/month) already runs two healthy self-hosted Supabase stacks (C9 and C6, 11 containers each) and Caddy. No new paid resource has been created. User handles backups separately.
- DigitalOcean Web Console provides root access; SSH rejects the existing local key. The Supabase Compose projects are `/opt/employee-hub/c9` and `/opt/employee-hub/c6`. Their database directories persist under each project's `volumes`, and storage containers mount `/var/lib/storage`. Caddy currently proxies `c9.165-245-183-45.sslip.io` to loopback port 8001 and `c6.165-245-183-45.sslip.io` to port 8002. Existing configuration and data have not been changed.
- The new generated DigitalOcean baseline combines the captured application schema, later required feature migrations, and API-owned tables. It now has a preamble that replaces hosted Auth identity lookup and removes hosted delivery/storage/realtime setup. It still needs a real PostgreSQL restore and tenant acceptance review before deployment.

## Supabase dependency inventory (pre-port baseline)

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

Direct browser SDK feature calls have now been removed. General app invalidation/presence/notification/DM/gratitude, voice presence/signaling, and PK reads/RPCs use tenant API routes. The unused browser SDK, project URL, and publishable key were removed from the frontend source and package manifest. Hosted edge-function source and Supabase SQL history remain as migration/reference material; Supabase remains available only for rollback and not as an application runtime dependency. The original count of 139 call sites across 32 files is a dated baseline.

## Data and identity risks

- Existing local seeds, exports, or snapshots may be stale. A fresh, timestamped export from each source project is required immediately before the migration rehearsal; compare source and destination counts and representative foreign-key, ownership, and Hall of Fame integrity checks.
- C9 and C6 must use independent API service configurations and independent PostgreSQL databases (separate clusters are also acceptable). Each API process accepts one `APP_TENANT` and one `TENANT_DATABASE_URL`, and validates the database name (`employee_hub_c9` or `employee_hub_c6`) against that tenant. Do not put both tenant database secrets into one runtime. Never copy C9 credentials or data into C6 or vice versa.
- Supabase Auth is separate from the public application schema. A read-only aggregate query against the Droplet found 8 C9 bcrypt password hashes (one at cost 6 and seven at cost 10) and 53 passwordless C9 accounts; all 56 C6 accounts are passwordless. The API now verifies imported bcrypt hashes with PostgreSQL `pgcrypto` and upgrades a successful login to its current scrypt format. OAuth identity transfer and per-tenant account reconciliation remain required.
- The SQL history embeds Supabase `auth.uid()`, RLS policies, `storage.objects`, and Supabase-specific realtime publication logic. These rules must become API authorization/validation and PostgreSQL constraints/transactions; applying those SQL files unchanged to DigitalOcean PostgreSQL will not migrate the application.
- Hall of Fame migration must preserve the current rule: Individual awards can have tied winners side by side; Team awards have one leader with members shown beneath. Migration checks must cover both award types and team membership.
- Data exports, image downloads, counts, and credential-backed source comparisons are blocked until Droplet and both Supabase projects are made accessible through approved secure channels. No credentials should be pasted into chat.
- Read-only query sets are prepared in `scripts/migration-audit-source.sql` and `scripts/migration-audit-target.sql`. Run the source file independently on C9 and C6 immediately before export; run the target file independently on `employee_hub_c9` and `employee_hub_c6` after import. Compare the table-count result sets per tenant and verify the profile/approval, storage, password-hash-format, team-member, and individual-tie checks. The source query reports password hash format/count only, never hash values.

## Implementation milestones (historical plan)

1. **Foundation (implemented locally):** establish one-tenant-per-API runtime configuration, explicit browser origin allowlist, cookie/session verification, and database readiness probe. Existing Workers keep serving static assets and now have a local `/api` reverse-proxy entrypoint to tenant APIs on DigitalOcean. The GitHub deploy workflows wait until each `C9_DO_API_ORIGIN` / `C6_DO_API_ORIGIN` repository variable is configured.
2. **Hall of Fame API (implemented locally):** transactional award endpoints, permissions, audit snapshots, and validation for tied Individuals and single-leader Teams. The frontend now calls these API routes directly; the DigitalOcean database and API still need deployment and verification.
3. **Auth API (implemented locally and wired in the frontend):** scrypt password storage, legacy bcrypt verification with login-time upgrade, password login/change/recovery, Resend delivery, approval-aware sessions, Google OAuth with PKCE, and verified-email account linking. The frontend now uses the DigitalOcean API for login, session restore, logout, password change/reset, username claims, and daily login streaks. OAuth identities and account approval state still need migration and tenant-specific Google OAuth settings.
4. **Daily mood check-ins (implemented and live):** DigitalOcean PostgreSQL migration, authenticated API writes, a daily popup, and admin-only daily results. Both live admin pages show the results card.
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
16. **Voice service (implemented and provisioned):** authenticated API presence heartbeats, queued WebRTC offer/answer/ICE delivery, and voice-session start/stop replace the browser's Supabase Realtime and RPC usage. TURN uses short-lived, user-scoped Coturn REST credentials signed on the DigitalOcean API. Coturn, server-side credentials, and firewall ports are configured; real-browser verification remains.
17. **PK API (implemented locally):** PK list/detail, approval status, side scores, leaderboards, champions, settings, violations, playbook library, and the currently-used transactional functions now route through the tenant API. Mutating RPCs run inside a transaction with validated, transaction-local user identity so existing PK SQL rules retain their authorization checks. The identity preamble and complete baseline builder are in `scripts/digitalocean-schema-preamble.sql` and `scripts/assemble-digitalocean-baseline.ps1`. Historical note (2026-10-07): no target database had been provisioned at that point; both tenant databases are now deployed and exercised, as recorded above.
18. **Browser SDK removal (implemented locally):** the frontend no longer imports the Supabase client, and its SDK and embedded project config were removed. Hosted edge-function source and Supabase migrations remain as legacy migration material pending production cutover.
19. **Scheduled database work (implemented locally):** tenant-bound API processes now run birthday notification creation, PK open expiry, PK auto-settlement, missed-update reminders, and monthly PK season archival without `pg_cron`. PostgreSQL advisory locks prevent duplicate execution if an API tenant has multiple replicas. Birthday email delivery remains deferred until Resend is configured.
20. Push subscription management, a database delivery queue, and VAPID delivery worker are deployed. Separate tenant VAPID keys are installed on the Droplet; end-to-end delivery verification remains. No subscriptions existed at provisioning time. Existing Supabase file objects have been transferred; confirm existing/new URLs during acceptance. Realtime screens use bounded polling.
21. Historical preparation milestone: source data and storage were imported for C9/C6; finish tenant acceptance independently.
22. Historical rollout approval milestone: the user authorized migration and production cutover; Supabase retirement remains pending acceptance.

## Remaining production work

- Verify login/session/logout, representative core reads and writes, PK transactions and authorization, and file upload/download paths independently for C9 and C6. Profile routes and Admin pages load in both tenants, but this is not complete feature acceptance.
- Reconcile the C9 Google identity through the existing approval process; no profile approval or role change has been made.
- Complete real-browser push delivery and voice-call acceptance. VAPID and Coturn are configured; no push permission was granted and no user mood/check-in data was submitted during verification.
- Resend is intentionally deferred. Password recovery and birthday email delivery remain unavailable until the sender is configured.
- The self-hosted Supabase containers are stopped, but their data remains on disk. Hosted Supabase projects are still present and have not been paused or deleted. Retire the hosted projects after both tenants pass acceptance and post-cutover writes are reconciled. The user handles backups separately.

The initial baseline restore and data/storage import are complete. See [`DIGITALOCEAN-BASELINE.md`](DIGITALOCEAN-BASELINE.md) for the applied state and fresh-target-only restore procedure.
## API runtime settings

Run the separate C9/C6 PostgreSQL and API containers from `deploy/digitalocean/docker-compose.yml`. Each tenant has a private Docker network, database, database owner, API process, and uploads directory. PostgreSQL TLS is enabled; only the API port is published, bound to host loopback behind Caddy. Keep Compose and API secrets in root-readable files under `/etc/employee-hub`; never put them in the repository or browser configuration. Coturn is an opt-in Compose `voice` profile and uses `/etc/employee-hub/turn.env`; each API tenant also needs `TURN_SHARED_SECRET` and `TURN_URLS` in its private env file. Open TCP/UDP 3478 and the configured UDP relay range before turning on the profile. Password recovery later needs server-side `RESEND_API_KEY` and `EMAIL_FROM`; Resend is intentionally deferred. Google sign-in uses tenant-specific `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and exact `GOOGLE_REDIRECT_URI`. `/api/healthz` reports the configured tenant; `/api/readyz` checks PostgreSQL connectivity without exposing connection details.

## Remaining acceptance and retirement checklist

- [ ] Verify C9 Google identity mapping and approval through the existing authorized admin workflow.
- [ ] Verify representative C9 and C6 product writes, PK settlement/authorization, and existing and new file URLs against their own tenant databases.
- [x] Configure per-tenant VAPID keys and the shared Coturn secret on the Droplet; open the required ports and confirm service listeners. Real-browser push and voice acceptance remains pending.
- [ ] Keep Resend disabled until the user configures it.
- [ ] Stop/remove the hosted Supabase projects after both tenants pass acceptance and any writes since cutover are reconciled. The user handles backups separately.
## Verification so far

- `pnpm run typecheck` passed across the workspace.
- API TypeScript typecheck passed.
- Hall of Fame routes and frontend API helper pass their TypeScript checks.
- API unit tests: 13 passed for password hashing/verification, C9/C6 database binding, OAuth/bridge configuration, and Hall of Fame individual/team rules.
- API production build passed. Engagement Hub production build passed with local `PORT` and `BASE_PATH` values; Vite reported existing sourcemap and large-chunk warnings.
- Both tenant APIs and both Worker `/api/readyz` routes returned `ready` for their matching tenant. Both live Admin pages and Daily mood results loaded after the successful `main` deployments. This confirms service routing/readiness, not full feature acceptance.
