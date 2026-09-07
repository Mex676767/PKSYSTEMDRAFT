import { createClient } from '@supabase/supabase-js';

// These values are DESIGNED to be public — safe to ship in client-side code
// and check into a public repo. Access control is handled by Postgres Row
// Level Security (RLS) policies on the Supabase project, not by keeping this
// key secret. Never put the `service_role`/`secret` key here or in any
// frontend code.
const SUPABASE_URL = 'https://xtajpneptcrkaingiiia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wu-Uoacbxx5lMZPWvQJB6w_s58YBpA_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
