// Which organisation this build is for. The same code builds the C9MYR hub
// (default) and the C6 hub; a build picks its brand and Supabase project with
// environment variables. See docs/C6-SETUP.md.
//
//   VITE_BRAND_NAME         short name in the nav pill and titles (default "C9MYR")
//   VITE_SUPABASE_URL       that organisation's Supabase project URL
//   VITE_SUPABASE_ANON_KEY  its publishable (anon) key

const env = import.meta.env;

export const BRAND_NAME: string = env.VITE_BRAND_NAME || "C9MYR";
export const BRAND_LOGO = `${import.meta.env.BASE_URL}brands/${BRAND_NAME.toUpperCase().startsWith("C6") ? "c6" : "c9"}/logo.png`;
export const BRAND_FULL_NAME = `${BRAND_NAME} Employee's Hub`;
export const BRAND_HUB_NAME = `${BRAND_NAME} Hub`;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || "https://xtajpneptcrkaingiiia.supabase.co";
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_wu-Uoacbxx5lMZPWvQJB6w_s58YBpA_";
