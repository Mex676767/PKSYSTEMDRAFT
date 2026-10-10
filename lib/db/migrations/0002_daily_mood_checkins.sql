CREATE TABLE IF NOT EXISTS public.daily_mood_checkins (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  mood text NOT NULL CHECK (mood IN ('Low', 'Not great', 'Okay', 'Good', 'Great')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS daily_mood_checkins_date_idx
  ON public.daily_mood_checkins (checkin_date, created_at DESC);
