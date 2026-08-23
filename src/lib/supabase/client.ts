import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Session is persisted via cookies (not
// localStorage) so the server client in server.ts can read the same
// session on the next request. Not currently imported anywhere — the app's
// auth flows all run server-side (Server Actions, proxy.ts) — kept for
// future client components that need auth state (realtime, client-side
// sign-out, etc). Session length is governed by SESSION_COOKIE_MAX_AGE_SECONDS
// applied server-side (see server.ts, proxy.ts); this client only ever
// reads the cookies they write.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
