# Enable admin certificate deletion

Certificates display rows from `public.hof_records`. Deleting a certificate removes its record; it does not delete the category or another historical record.

In the existing project's Supabase dashboard, open **SQL Editor → New query**, paste and run the contents of [0012_hof_records_delete.sql](migrations/0012_hof_records_delete.sql). The script can be run again safely. It enables deletion only for signed-in administrators or users with `manage_hall_of_fame` permission.

GitHub Pages deployment does not execute Supabase migrations. Run this SQL separately, then reload the app and use **Guinness Records → View certificate → Delete record**. Confirm only for a record you intend to remove. The app now reports permission errors and zero-row deletions rather than claiming success.

You can check the installed policy without deleting data:

```sql
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'hof_records'
  and cmd = 'DELETE';
```
