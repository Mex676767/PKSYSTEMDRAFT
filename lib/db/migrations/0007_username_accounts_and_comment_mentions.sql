-- Optional recovery email and comment deep links for the DigitalOcean API.
BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_check;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_check
  CHECK (char_length(body) >= 1 AND char_length(body) <= 2000);

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_author uuid;
  replier_username text;
BEGIN
  IF new.parent_comment_id IS NULL THEN RETURN new; END IF;
  SELECT author_id INTO parent_author FROM public.comments WHERE id = new.parent_comment_id;
  IF parent_author IS NULL OR parent_author = new.author_id THEN RETURN new; END IF;
  SELECT username INTO replier_username FROM public.profiles WHERE id = new.author_id;
  INSERT INTO public.notifications (user_id, actor_id, type, target_type, target_id, comment_id, message)
  VALUES (parent_author, new.author_id, 'comment', new.target_type, new.target_id, new.id,
          coalesce('@' || replier_username, 'Someone') || ' replied to your comment');
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
  actor_username text;
BEGIN
  owner := public.get_target_owner(new.target_type, new.target_id);
  IF owner IS NULL OR owner = new.author_id THEN RETURN new; END IF;
  SELECT username INTO actor_username FROM public.profiles WHERE id = new.author_id;
  INSERT INTO public.notifications (user_id, actor_id, type, target_type, target_id, comment_id, message)
  VALUES (owner, new.author_id, 'comment', new.target_type, new.target_id, new.id,
          coalesce('@' || actor_username, 'Someone') || ' commented on your ' || new.target_type);
  RETURN new;
END;
$$;

COMMIT;
