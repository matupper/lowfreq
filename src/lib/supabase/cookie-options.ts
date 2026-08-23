// Shared between server.ts and proxy.ts, the two places that write the
// Supabase session cookie, so a signed-in session survives browser restarts
// for a consistent, deliberately-chosen duration instead of whatever
// @supabase/ssr's own internals decide.
//
// This can't be done via createServerClient's `cookieOptions.maxAge` param:
// @supabase/ssr 0.12.4 hardcodes maxAge to its own DEFAULT_COOKIE_OPTIONS
// (400 days — the longest Chrome honors) inside applyServerStorage,
// ignoring whatever the caller passed (confirmed by reading
// node_modules/@supabase/ssr/dist/module/cookies.js and reproducing it
// against the real project). Every Set-Cookie the app writes for the
// session must have its maxAge overridden after the fact, in the `setAll`
// cookie callback, which is why this constant is consumed there instead of
// via cookieOptions.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
