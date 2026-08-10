import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Session is persisted via cookies (not
// localStorage) so the server client in server.ts can read the same
// session on the next request.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
