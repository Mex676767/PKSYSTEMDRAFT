BEGIN;

CREATE TABLE IF NOT EXISTS public.voice_presence (
  channel_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  muted boolean NOT NULL DEFAULT false,
  deafened boolean NOT NULL DEFAULT false,
  streaming boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id),
  CHECK (length(channel_id) BETWEEN 1 AND 120),
  CHECK (length(username) BETWEEN 1 AND 80)
);
CREATE INDEX IF NOT EXISTS voice_presence_seen_idx ON public.voice_presence(channel_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id text NOT NULL,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(channel_id) BETWEEN 1 AND 120),
  CHECK (from_user_id <> to_user_id),
  CHECK (pg_column_size(payload) <= 65536)
);
CREATE INDEX IF NOT EXISTS voice_signals_recipient_idx ON public.voice_signals(to_user_id, channel_id, id);

COMMIT;
