# Push notifications setup

Browser push sends every in-app notification (comments, replies, reactions,
challenges, DMs, birthdays, completed goals, points, achievements) to the
devices people have turned push on for, even when the hub is closed. People
turn it on per device from the bell menu → **Push notifications → Turn on**.

Until the steps below are done the app works as before: notifications still
appear in the bell, and the push switch says it isn't set up yet.

## 1. Generate VAPID keys (once)

```sh
cd artifacts/engagement-hub
node scripts/generate-vapid-keys.mjs
```

Keep the private key secret. If you ever change the keys, everyone has to turn
push on again.

## 2. Deploy the edge function with its secrets

```sh
supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:<an admin email> \
  PUSH_WEBHOOK_SECRET=<a long random string>

supabase functions deploy send-push --no-verify-jwt
```

`--no-verify-jwt` is required: the database calls this function with
`PUSH_WEBHOOK_SECRET` rather than a user token. The function rejects any POST
without that secret.

## 3. Run the migrations

Run `migrations/0016_push_notifications.sql` (and any earlier ones not yet
applied) in the SQL editor. It enables `pg_net` and `pg_cron`; if `pg_cron`
can't be enabled you'll see a warning and birthday notifications won't be
scheduled (enable it under Database → Extensions and re-run the migration).

## 4. Tell the database how to reach the function

In the SQL editor, with your project's URL and the same secret as step 2:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');
```

## Birthday notifications

Once a day everyone gets an in-app (and push) notification for each birthday,
and the birthday person gets their own. The job runs hourly and sends at 8:00
in `Asia/Kuala_Lumpur` time. To change the timezone or hour, reschedule it:

```sql
select cron.schedule('birthday-notifications', '5 * * * *',
  $$select notify_todays_birthdays('Asia/Singapore', 9)$$);
```

## Notes

- iPhone/iPad only support web push for sites added to the Home Screen.
- Signing out turns push off for that device, so the next person to sign in
  there doesn't receive the previous person's notifications.
- Devices whose subscription has expired are removed automatically.
