-- Use the existing comment notification type to support older enum/check constraints.
begin;
alter table comments
  add column if not exists parent_comment_id uuid references comments(id) on delete cascade;

create index if not exists comments_parent_comment_id_idx on comments(parent_comment_id);

-- Notify a comment's author when someone replies to it specifically (in
-- addition to whatever existing notification the target owner gets for any
-- new comment on their goal/post/etc).
create or replace function notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_author uuid;
  replier_username text;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  parent_author := (select author_id from comments where id = new.parent_comment_id);
  if parent_author is null or parent_author = new.author_id then
    return new;
  end if;

  replier_username := (select username from profiles where id = new.author_id);

  insert into notifications (user_id, actor_id, type, target_type, target_id, message)
  values (
    parent_author,
    new.author_id,
    'comment',
    new.target_type,
    new.target_id,
    coalesce('@' || replier_username, 'Someone') || ' replied to your comment'
  );

  return new;
end;
$$;

drop trigger if exists on_comment_reply on comments;
create trigger on_comment_reply
  after insert on comments
  for each row
  execute function notify_comment_reply();

notify pgrst, 'reload schema';
commit;
