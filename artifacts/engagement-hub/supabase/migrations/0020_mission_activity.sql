-- Points revamp, part 2: an activity log that missions count from. Triggers
-- on the existing tables record who did what; they never block the original
-- write (any error is swallowed as a warning). Counting starts from when this
-- migration runs. Challenge activity is deliberately not tracked yet.

create table if not exists mission_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  ref_id text,
  occurred_at timestamptz not null default now()
);
create index if not exists mission_activity_lookup on mission_activity (user_id, kind, occurred_at);
alter table mission_activity enable row level security;

-- Trigger args: kind, column holding the user id, column to de-duplicate on
-- (e.g. reacting to the same post twice counts once; '' = the row itself).
create or replace function log_mission_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := tg_argv[0];
  row_new jsonb := to_jsonb(new);
  row_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  uid uuid;
  ref text;
begin
  begin
    uid := nullif(row_new ->> tg_argv[1], '')::uuid;
    ref := coalesce(row_new ->> nullif(tg_argv[2], ''), row_new ->> 'id');
    if uid is null then
      return new;
    end if;
    if kind = 'birthday_wish' and coalesce(row_new ->> 'target_type', '') <> 'birthday' then
      return new;
    end if;
    if kind = 'quiz_correct' and coalesce((row_new ->> 'correct')::boolean, false) = false then
      return new;
    end if;
    if kind in ('goal_complete', 'wordle_solve') then
      if coalesce((row_new ->> case when kind = 'goal_complete' then 'completed' else 'solved' end)::boolean, false) = false
         or coalesce((row_old ->> case when kind = 'goal_complete' then 'completed' else 'solved' end)::boolean, false) = true then
        return new;
      end if;
    end if;
    insert into mission_activity (user_id, kind, ref_id) values (uid, kind, ref);
  exception when others then
    raise warning 'log_mission_activity(%): %', kind, sqlerrm;
  end;
  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select *
    from (values
      ('login_sessions',  'login',          'user_id',     '',            'insert'),
      ('posts',           'post',           'author_id',   '',            'insert'),
      ('comments',        'comment',        'author_id',   '',            'insert'),
      ('comments',        'birthday_wish',  'author_id',   'target_id',   'insert'),
      ('reactions',       'reaction',       'user_id',     'target_id',   'insert'),
      ('goals',           'goal_create',    'owner_id',    '',            'insert'),
      ('goals',           'goal_complete',  'owner_id',    '',            'update'),
      ('goal_updates',    'goal_update',    'author_id',   '',            'insert'),
      ('progress_photos', 'progress_photo', 'uploader_id', '',            'insert'),
      ('quiz_answers',    'quiz_correct',   'user_id',     'question_id', 'insert'),
      ('wordle_results',  'wordle_solve',   'user_id',     '',            'insert or update'),
      ('direct_messages', 'message',        'sender_id',   '',            'insert'),
      ('voice_sessions',  'voice_join',     'user_id',     '',            'insert')
    ) as v(tbl, kind, user_col, ref_col, ev)
  loop
    if to_regclass('public.' || t.tbl) is null then
      raise notice 'mission activity: table % not found, skipping %', t.tbl, t.kind;
      continue;
    end if;
    execute format('drop trigger if exists %I on %I', 'mission_activity_' || t.kind, t.tbl);
    execute format(
      'create trigger %I after %s on %I for each row execute function log_mission_activity(%L, %L, %L)',
      'mission_activity_' || t.kind, t.ev, t.tbl, t.kind, t.user_col, t.ref_col
    );
  end loop;
end;
$$;
