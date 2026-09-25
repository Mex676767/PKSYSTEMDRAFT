# C6 hub setup

C6 runs the same code as the C9MYR hub, on its own domain, with its **own
Supabase project** so the two organisations' data can never mix. Every push to
`main` redeploys both sites:

| | C9MYR | C6 |
|---|---|---|
| Code | this repo, `main` | this repo, `main` |
| Hosting | GitHub Pages (`deploy-pages.yml`) | Cloudflare Pages (`deploy-c6.yml`) |
| Database | Supabase project "C9MYR" | Supabase project "C6MYR" |
| Name in the nav pill and titles | C9MYR | `C6_BRAND_NAME` (default `C6`) |

How the switch works: `src/lib/brand.ts` reads `VITE_BRAND_NAME`,
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time. With none set,
the build is C9MYR, exactly as before. `vite.config.ts` also swaps the name in
`index.html`, `privacy.html` and `push-sw.js`.

## 1. Copy C9MYR's database structure (no data)

The migrations folder only has changes from `0001` onwards, not the original
tables, so C6 needs a structure export. On your computer, with Docker Desktop
running:

```
cd artifacts\engagement-hub
npx supabase db dump --db-url "C9MYR_SESSION_POOLER_CONNECTION_STRING" -f supabase\schema.sql
git add supabase\schema.sql
git commit -m "Add baseline schema"
git push
```

Get the connection string from the C9MYR project: **Connect** → **Session pooler**.
It contains the database password, so never paste it into a chat or commit it.
`schema.sql` holds only tables and functions, no employee data.

## 2. Set up C6's database

In the **C6MYR** project's SQL editor, run these in order. Open each file in a
text editor (e.g. Notepad), select all and paste, rather than copying from a
preview that may cut it short:

1. `supabase/schema.sql`
2. `supabase/c6-seed.sql`: settings rows, default roles, the Management
   department, built-in achievements, scheduled jobs and live updates.

From then on, **every new migration must be run on both projects.**

## 3. C6 project settings

- **Authentication → Sign In / Providers:** turn on the same methods as C9MYR.
  Google sign-in needs its own OAuth client with C6's domain.
- **Authentication → URL Configuration:** Site URL = C6's domain; add it to the
  redirect URLs too.
- **Storage:** nothing to do; `c6-seed.sql` creates the `post-images` bucket and its rules.
- **Edge functions**, from `artifacts\engagement-hub`, with C6's project ref:
  ```
  npx supabase functions deploy send-push --project-ref C6_REF --no-verify-jwt
  npx supabase functions deploy get-turn-credentials --project-ref C6_REF
  npx supabase functions deploy send-birthday-emails --project-ref C6_REF --no-verify-jwt
  ```
  Then set the function secrets for C6 as in `supabase/PUSH-NOTIFICATIONS.md`,
  using **new** VAPID keys, plus `APP_NAME` = `C6MYR Hub` (or whatever the name
  is). The Cloudflare voice-call keys can be the same as C9MYR's.
- **Vault** (SQL editor): add `project_url` and `push_webhook_secret` for C6,
  as in `supabase/PUSH-NOTIFICATIONS.md`.

## 4. Cloudflare Pages

1. Create a free Cloudflare account.
2. **Workers & Pages → Create → Pages → Upload assets**, name the project
   `c6-hub`, and upload any small file to create it. The workflow replaces it.
3. **Account ID:** shown on the Workers & Pages overview.
4. **API token:** My Profile → API Tokens → Create token → "Edit Cloudflare
   Workers" template, or a custom token with **Account → Cloudflare Pages → Edit**.

## 5. GitHub settings

Repo → **Settings → Secrets and variables → Actions**:

- **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Variables:**
  - `C6_SUPABASE_URL`: C6MYR's Project URL (`https://xxxx.supabase.co`)
  - `C6_SUPABASE_ANON_KEY`: C6MYR's publishable key (`sb_publishable_…`)
  - `C6_BRAND_NAME`: the name to show, e.g. `C6` or `C6MYR`
  - `C6_PAGES_PROJECT`: only if the Pages project isn't called `c6-hub`

The workflow does nothing until `C6_SUPABASE_URL` is set. After setting
everything, run it once from **Actions → Deploy C6 hub → Run workflow**.

## 6. Domain and first admin

- Cloudflare Pages → `c6-hub` → **Custom domains** → add C6's domain.
- Sign up on the C6 site, then in C6's SQL editor:
  ```sql
  update profiles set is_admin = true where email = 'you@example.com';
  ```
