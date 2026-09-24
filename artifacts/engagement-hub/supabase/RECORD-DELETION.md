# Hall of Fame, deletion audit and reply setup

The frontend deployment does not run SQL migrations. In the existing Supabase project, open **SQL Editor → New query** and run these files in order:

1. [0017_manual_hof_and_deletion_audit.sql](migrations/0017_manual_hof_and_deletion_audit.sql)
2. [0018_comment_reply_notifications.sql](migrations/0018_comment_reply_notifications.sql)

Both files can be run again. Migration 0017 replaces the previous record-deletion approach from 0012 with explicit, server-authorized operations; all active admins qualify without needing individual permissions. Guinness Records managers can also delete records/categories. It creates human-managed Hall of Fame categories and winners, disables the old automatic podium/exclusion functions, and starts database deletion auditing. Existing Guinness records remain intact. Old exclusion rows are retained only as historical data and are not used.

## Editing

- **Hall of Fame → team → month → Edit Hall of Fame:** add or rename categories, choose up to three distinct winners, and enter an optional score/achievement for each. Save each category's monthly winners. Removing a winner or deleting a category creates an audit entry. Saving winners replaces the previous monthly selection atomically and logs the replaced rows. Categories belong to teams; winners belong to a category and month.
- **Guinness Records → Delete category:** removes that category and all its current/historical records and certificates after confirmation. Each deletion is logged. **View certificate → Delete record** removes only the selected record.
- **Edit / deletion logs:** shows the latest 100 deletions with who, when, and the saved record details. Logs are readable only by administrators/managers; normal clients cannot create, change or erase them. Earlier deletions cannot be reconstructed.
- Admins have both management abilities automatically. Delegate using **Manage Hall of Fame** or **Manage Guinness Records** in the existing permissions panel.

Migration 0018 ensures the reply column/trigger exists and uses the already-supported `comment` notification type with a "replied to your comment" message. This avoids replies rolling back on older databases whose notification type constraint rejects `reply`. It does not remove existing comments or weaken notification access controls.

## Checks after applying

Refresh the app, create a Hall of Fame category, save a monthly podium and reload to confirm persistence. For deletion, use only an intentionally disposable record: verify it disappears and its snapshot appears in the edit panel. Test a reply to another account and confirm the reply and notification arrive. Regular members should have no edit/delete-category controls and cannot call the management operations successfully.
