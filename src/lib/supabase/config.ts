// Public values only (safe in the browser). Security comes from RLS in the database.
// Vercel env vars override these if set.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qnfenbetcdqwcrlvwffr.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_lGY_OUDWb1-GD343w79IgA_OuTllSN-";

// Staff sign in with a username. Supabase needs an email, so we use an internal one.
export const emailForUsername = (u: string) => `${u.trim().toLowerCase()}@crm.apsthai.local`;
