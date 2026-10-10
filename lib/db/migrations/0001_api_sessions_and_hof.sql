-- Employee Hub API foundation. Apply to a newly imported application
-- database only after its profiles and existing application tables exist.
BEGIN;

CREATE TABLE IF NOT EXISTS public.api_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_sessions_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS api_sessions_user_expiry_idx
  ON public.api_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.api_password_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_password_reset_tokens (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT api_password_reset_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS api_password_reset_user_idx
  ON public.api_password_reset_tokens (user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.api_oauth_identities (
  provider text NOT NULL,
  provider_subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject),
  CONSTRAINT api_oauth_provider_supported CHECK (provider IN ('google'))
);
CREATE INDEX IF NOT EXISTS api_oauth_identities_user_idx
  ON public.api_oauth_identities (user_id);

ALTER TABLE public.hof_award_categories
  ADD COLUMN IF NOT EXISTS award_type text NOT NULL DEFAULT 'individual';
ALTER TABLE public.hof_award_categories
  DROP CONSTRAINT IF EXISTS hof_award_categories_award_type_check;
ALTER TABLE public.hof_award_categories
  ADD CONSTRAINT hof_award_categories_award_type_check
  CHECK (award_type IN ('individual', 'team'));

ALTER TABLE public.hof_award_winners
  ADD COLUMN IF NOT EXISTS team_member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.hof_award_winners
  DROP CONSTRAINT IF EXISTS hof_award_winners_category_id_month_rank_key;
COMMIT;
