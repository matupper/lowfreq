<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deploying db/ changes

Committing a file under `db/migrations/` does **not** apply it anywhere — it
only lives in git until something runs it against a real Supabase project.
There is no CI/CD step or git hook that pushes migrations automatically.
Check `list_migrations` (or the Supabase dashboard's migration history)
against `db/migrations/` before assuming a committed migration is live;
`db/schema.sql` is the intended full-recreate source of truth but is not
authoritative for what's actually deployed either. Apply drift with
`apply_migration` (or `supabase db push` if using the CLI locally) — see
`git log` on 2026-08-23 for a case where two full migrations landed in a
PR but were never applied to `lowfreq-dev`, silently breaking invite
registration, location-verified invites, and attendance end to end while
existing code review, tests, and docs all treated the feature as shipped.

## Supabase session cookies: `cookieOptions.maxAge` is a no-op

`@supabase/ssr` (checked at 0.12.4) hardcodes the `maxAge` it writes for the
session cookie to its own internal 400-day default inside
`applyServerStorage` / the browser `setItem` path, and ignores whatever is
passed as `createServerClient`/`createBrowserClient`'s `cookieOptions.maxAge`
— confirmed by reading `node_modules/@supabase/ssr/dist/module/cookies.js`
and reproducing it live. To actually control session length, override
`maxAge` in the `setAll` cookie callback itself (see
`src/lib/supabase/server.ts`, `src/proxy.ts`, and the shared
`SESSION_COOKIE_MAX_AGE_SECONDS` constant in
`src/lib/supabase/cookie-options.ts`) rather than trusting the
`cookieOptions` param. Re-verify this against the installed version before
relying on `cookieOptions.maxAge` again — a future `@supabase/ssr` upgrade
may fix this, at which point the `setAll` override becomes redundant but
harmless.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
