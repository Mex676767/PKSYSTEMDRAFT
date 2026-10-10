BEGIN;

CREATE TABLE IF NOT EXISTS public.app_presence (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  path text NOT NULL,
  activity text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS app_presence_last_seen_idx ON public.app_presence (last_seen_at DESC);

COMMIT;
