// Public values only. The publishable key is safe in the browser; RLS protects the data.
export const SUPABASE_URL = "https://qnfenbetcdqwcrlvwffr.supabase.co";
export const SUPABASE_KEY = "sb_publishable_lGY_OUDWb1-GD343w79IgA_OuTllSN-";

// Staff sign in with a username. Supabase Auth stores it as an internal address that never receives mail.
export const emailForUsername = (username: string) => `${username.trim().toLowerCase()}@crm.apsthai.local`;
