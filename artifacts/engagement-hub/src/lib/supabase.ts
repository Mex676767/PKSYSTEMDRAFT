import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtajpneptcrkaingiiia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wu-Uoacbxx5lMZPWvQJB6w_s58YBpA_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
