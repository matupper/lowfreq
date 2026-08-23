import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_COOKIE_MAX_AGE_SECONDS } from "./cookie-options";

// Server-side Supabase client for use in Server Components, Server
// Actions, and Route Handlers. Reads/writes the session via the request's
// cookies so it stays in sync with the browser client.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // @supabase/ssr hardcodes maxAge to its own 400-day default
            // internally and ignores a `cookieOptions.maxAge` passed to
            // createServerClient (verified against the installed version),
            // so the only place this app can actually control session
            // length is by overriding it here, on the options it already
            // computed for every other cookie attribute.
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(options.maxAge
                  ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS }
                  : {}),
              })
            );
          } catch {
            // Called from a Server Component render, where cookies can't
            // be set. Safe to ignore — proxy.ts refreshes the session on
            // every request, so this only affects the current render.
          }
        },
      },
    }
  );
}
