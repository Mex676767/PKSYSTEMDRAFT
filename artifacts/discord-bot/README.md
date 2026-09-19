# C9MYR Discord presence bot

Watches your Discord server's voice channels and presence, and writes each
linked teammate's live status into Supabase so the web app can show their
status: active (in a work voice channel), training, in a meeting, AFK, on a
break, online/idle (not in voice), or offline.

## Setup

1. **Create the Discord application**
   - Go to https://discord.com/developers/applications -> New Application.
   - Under **Bot**, click "Add Bot", then enable these three **Privileged
     Gateway Intents**: `Server Members Intent`, `Presence Intent`.
   - Copy the bot token (Bot page -> Reset Token) into `DISCORD_BOT_TOKEN`.
   - Under **OAuth2**, copy the **Client ID** -- paste it into the web app's
     `src/lib/discord.ts` (`DISCORD_CLIENT_ID`), and add a redirect URI of
     `<your site URL>/discord-callback` (matches what
     `src/lib/discord.ts#discordRedirectUri` builds).
   - Under **OAuth2 > General**, copy the **Client Secret** -- this goes
     into the `discord-oauth` Supabase Edge Function's secrets, never into
     this bot or the frontend.

2. **Invite the bot to your server**
   - OAuth2 -> URL Generator -> scopes: `bot`. Permissions: `View Channels`,
     `Connect` (so it can see voice states). Open the generated URL and
     invite it to your server.
   - Copy your server's ID (right-click the server icon -> Copy Server ID,
     with Developer Mode on) into `DISCORD_GUILD_ID`.

3. **Configure and run**
   ```bash
   cp .env.example .env
   # fill in DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, SUPABASE_SERVICE_ROLE_KEY
   npm install
   npm start
   ```
   `SUPABASE_SERVICE_ROLE_KEY` is in your Supabase project's
   Settings -> API -> service_role key. Keep it secret -- it bypasses RLS.

4. **Run the SQL migrations first** -- see
   `../engagement-hub/supabase/migrations/0001_discord_integration.sql` and
   `0002_discord_presence_categories.sql`. Paste each into the Supabase SQL
   Editor and run them once, in order.

## How channel categories are decided

The bot doesn't need a channel ID allowlist. It classifies a voice channel
by matching keywords in its name (case-insensitive substring match), in
this order: `afk` -> "afk", `training` -> "training", `meeting` -> "meeting",
`lunch`/`dinner`/`break` -> "break", everything else -> "active". For your
server that means `AFK` is afk, `Training Room` is training, `Meeting Room
1/2/3` are meetings, `Lunch Break/Dinner Break` is a break; `General`,
`Designer`, `Data Analysis`, `Marketing`, `Retention - T1 & T2`, `VIP
Retention - Tier ...`, etc. are all active. Edit the `CATEGORY_KEYWORDS`
list in `index.js` if you rename or add channels.

## Hosting

This needs to run continuously (it holds a Gateway websocket open), so it
can't live on GitHub Pages alongside the web app, and it can't run on
Cloudflare Workers either (no persistent connections there). Deploy it to
Railway instead:

1. Go to https://railway.app -> New Project -> **Deploy from GitHub repo** ->
   pick this repo.
2. Once the service is created, open its **Settings** tab and set
   **Root Directory** to `artifacts/discord-bot`. Railway will pick up
   `railway.toml` in that folder and run `npm start` automatically.
3. Open the **Variables** tab and add each of these (same values as your
   local `.env`):
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESYNC_INTERVAL_MINUTES` (optional, defaults to `5`)
4. Deploy. Check the **Deployments -> Logs** tab for `Logged in as ...` and
   `Linked profiles: N` to confirm it's running -- same output you'd see
   locally. It'll auto-redeploy on every push to this repo, and auto-restart
   if it ever crashes (`restartPolicy` in `railway.toml`).

Once it's running on Railway, you can close your local terminal -- it no
longer depends on your PC being on.
