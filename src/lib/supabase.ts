import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side / browser Supabase client. For server-only privileged
// operations later (e.g. verifying invites), create a separate client
// using the service role key inside server actions or route handlers —
// never expose that key to the browser.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
