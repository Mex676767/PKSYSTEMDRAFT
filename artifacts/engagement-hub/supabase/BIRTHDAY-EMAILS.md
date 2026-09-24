# Birthday emails setup

Two emails, edited in **Admin → Birthday Emails**:

- **Team announcement**: to every employee, naming everyone with a birthday
  that day. When the birthday person email is on, the birthday people get that
  one instead of the announcement.
- **Birthday person**: a personal email to each person celebrating.

They go out once a day at the time and time zone chosen in the admin card. A
job checks hourly (at :10); each email is sent at most once per person per
day, and a failed send is retried on the next hourly run. Recent sends and
errors show at the bottom of the card.

Nothing is sent until **all** of these are done and an email is switched on.

## 1. Verify a sending domain with Resend

1. Create an account at resend.com (free tier is fine to start).
2. **Domains → Add domain** (e.g. `yourcompany.com`) and add the DNS records it
   shows at your domain provider. Wait until it says **Verified**.
3. **API Keys → Create API key** (sending access). Copy it.

The sender email in the admin card must be on that verified domain, e.g.
`hub@yourcompany.com`.

## 2. Deploy the function

```sh
cd artifacts/engagement-hub
npx supabase secrets set RESEND_API_KEY=<your Resend API key> --project-ref <project-ref>
npx supabase functions deploy send-birthday-emails --project-ref <project-ref> --no-verify-jwt
```

It reuses the `PUSH_WEBHOOK_SECRET` secret and the Vault secrets
(`project_url`, `push_webhook_secret`) already set up for push notifications,
so there's nothing else to add.

## 3. Run the migration

Run `migrations/0024_birthday_emails.sql` in the SQL editor. It adds the
personal email and schedule settings, the send log, and the hourly job.

## 4. Test

In the admin card, save your settings and press **Send test to me** on each
email. It sends to your own address only, with sample names, and shows the
email service's error message if something isn't set up yet.
