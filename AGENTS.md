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

## Server Actions that call Supabase auth methods implicitly refresh the current page

Any `@supabase/ssr` auth call (`signUp`, `signInWithPassword`, `signOut`, a
session refresh) writes cookies via the `setAll` callback in
`src/lib/supabase/server.ts`. Per Next.js's docs on mutating data ("Cookies"
section, `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`),
setting/deleting a cookie inside a Server Action makes Next.js re-render the
current route's Server Components — same mechanism as calling `refresh()`
explicitly, but implicit. If a page derives what to render from mutable DB
state (e.g. `src/app/signup/page.tsx` checking whether an invite token is
still `unused`), and the Server Action just mutated that same state (e.g.
`redeem_invite` marking it `used`), the implicit re-render can swap the
page's whole subtree — discarding any client-local `useActionState` result
that was about to be shown in its place, with no error and no client-visible
signal that it happened. This bit `src/app/signup/actions.ts`'s
`registerWithInvite`: the "signup succeeded, no session because email
confirmation is required" outcome used to return inline state for
`RegisterForm` to render, and got silently replaced by `signup/page.tsx`'s
"invite already used" screen. Fix pattern: when a Server Action mutates
state a wrapping page re-derives from, don't return outcome-describing state
for a sibling/child Client Component to render on the same route —
`redirect()` to a route that isn't gated on that same state instead (see
`registerWithInvite`'s redirect to `/signup/check-email`). A `redirect()`
call itself is safe even after such a cookie write, since the browser
navigates away entirely rather than re-rendering the current route.

## Fresh worktree: `npm install` before trusting a "module not found"

A freshly created git worktree here can have a `node_modules/` that's out
of sync with `package-lock.json` (e.g. missing a package the lockfile
already resolves) even though `node_modules/` isn't empty. This looks
exactly like a real bug (Next.js dev/build throws `Module not found`) but
isn't one — run `npm install` first and see if it goes away before
diagnosing further. Confirm with `npm ls <package>` vs. `node -e
"console.log(require('./package-lock.json').packages['node_modules/<package>'])"`
before concluding a dependency is genuinely missing from the project.

## chrome-devtools-axi: worker never responds ("Target closed") in this environment

`chrome-devtools-axi start`/`open` can fail with `Protocol error
(Target.setDiscoverTargets): Target closed` here — the underlying
`chrome-devtools-mcp` server launches Chrome with Puppeteer's `pipe: true`
CDP transport, and the nested `npm exec ... | sh -c ...` process wrapping
chrome-devtools-axi uses to spawn it doesn't reliably preserve the pipe's
file descriptors. Chrome itself launches fine (verified directly with the
same flags). Workaround: launch Chrome yourself with a real
`--remote-debugging-port`, then point the bridge at it instead of letting
it launch its own:
```
CHROME=~/.cache/puppeteer/chrome/*/chrome-linux64/chrome
"$CHROME" --headless --disable-dev-shm-usage --no-sandbox --remote-debugging-port=9333 \
  --user-data-dir=/some/scratch/dir about:blank &
CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 chrome-devtools-axi start
```
This machine also runs multiple concurrent agent sessions sharing the
default chrome-devtools-axi bridge/port — set `CHROME_DEVTOOLS_AXI_SESSION`
to a unique name to avoid colliding with another session's browser.

A second, distinct failure mode (seen 2026-08-25): every command errors with
`MCP error -32602: Input validation error: Invalid arguments for tool
take_snapshot: Required at pageId` (also hits `evaluate_script`,
`screenshot` silently no-ops without writing a file), and `pages` never
marks any tab `selected: true` — happens even with the `--browserUrl`
workaround above and after a full bridge restart, so it isn't specific to
one launch mode. Root cause: `chrome-devtools-axi` (0.1.30 at time of
writing) bootstraps `chrome-devtools-mcp` via `npx -y
chrome-devtools-mcp@latest`, and mcp 1.8.0 added a required `pageId` param
this axi version doesn't yet send. Fix: pin to a known-good mcp version
instead of `@latest` —
```
mkdir -p /some/scratch/dir/cdm-1.7.0 && cd /some/scratch/dir/cdm-1.7.0
npm install chrome-devtools-mcp@1.7.0 --no-save
export CHROME_DEVTOOLS_AXI_MCP_PATH="$PWD/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js"
chrome-devtools-axi start   # combine with CHROME_DEVTOOLS_AXI_BROWSER_URL above if also hitting the first issue
```
Re-check the installed `chrome-devtools-mcp` version (`npm view
chrome-devtools-mcp version`) before assuming 1.7.0 is still the right pin —
a future `chrome-devtools-axi` release may catch up and make this
unnecessary.

## Browser-testing signup: real domain required, and email sends are rate-limited

Supabase Auth on `lowfreq-dev` rejects signup with a "Email address is
invalid" error for placeholder domains like `example.com` or a made-up
`*.dev` domain — use a real, deliverable domain (e.g. your own address with
`+something` tagging) when exercising the signup form end-to-end in a
browser. Each signup attempt also sends a real confirmation email even on
failure paths, and the project's free-tier send quota is easy to exhaust
across a few retries — expect "email rate limit exceeded" after a handful of
attempts in one session, with no visible reset countdown. To finish testing
a signed-in flow without waiting on a real inbox or the quota, confirm the
test account directly instead of clicking the email link: `update
auth.users set email_confirmed_at = now() where email = '<test address>'`
via the Supabase SQL tool. A manually-inserted `invites` row for the test
signup needs its `token` in the exact form `normalizeInviteToken()`
(`src/lib/invites.ts`) would produce from the URL — uppercase, no
separators — since the redemption lookup does a raw string match.

## Mutating specific `users` columns: RPC, not an RLS UPDATE policy

`users` has no RLS `update` policy, and that's deliberate — the table also
holds `phone`/`invited_by`/`created_at`, and a plain `auth.uid() = id`
`UPDATE` policy can only restrict which *rows* a client changes, not which
*columns*. Every user-editable field on `users` (`handle`, `avatar_url`)
is instead set through a narrow security-definer RPC that touches only
that one column (`set_handle`, `set_avatar_url` in db/schema.sql — same
pattern as `redeem_invite`/`revoke_invite`/`set_rsvp_going`). Add new
`users` mutations the same way rather than opening the table up.

## Avatar storage: fixed path + cache-busting URL

Avatars live in the public `avatars` Storage bucket at one fixed path per
user (`<user_id>/avatar.<ext>`), uploaded with `upsert: true` so a
re-upload overwrites in place instead of accumulating orphaned objects.
Because the path never changes, the *URL* doesn't change either on
re-upload — browsers/CDNs will keep serving the old cached image unless
something busts the cache. `users.avatar_url` is stored with a `?v=<ts>`
query param appended at save time (see `updateProfile` in
src/app/profile/edit/actions.ts) specifically for this; don't strip it
when reading/displaying the URL elsewhere.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
