@AGENTS.md
# lowfreq — project context

## What this is
An invite-only app for connecting with a local underground music scene.
Browse nearby shows, RSVP with a headcount. The core differentiator: you
can't sign up on your own — an existing member has to invite you in
person via a stamped QR code. This is deliberate, not a limitation to
work around — it's the product's answer to "underground apps that go
mainstream stop being underground."

## Visual concept — read before touching UI
Reference point is physical show ephemera (xeroxed flyers, riso zine
covers, wrist stamps at the door), NOT early-internet/MySpace nostalgia.
Early-web signals (tiled backgrounds, blinking text, glitter cursors)
are explicitly rejected — they read as costume, not culture.

Motif rules (see full style guide for the rest):
- Rotate flyer/event cards -1° to 1° max. Never rotate buttons or body text.
- Dashed/perforated dividers instead of hard rules where it fits the paper motif.
- The ink-stamp visual + Special Elite typeface are reserved for ONE
  moment: verification/invite confirmation. Don't reuse elsewhere.
- Max one accent color per screen (riso pink OR stamp red, rarely both).
- Dark mode is the DEFAULT theme, not an afterthought. Never pure #000 —
  always the warm near-black tokens already in globals.css.

## Typography
Display: Anton (all-caps by nature — lean into it, don't fight it with
mixed-case headlines elsewhere). Body: Inter. Metadata/timestamps/stubs:
IBM Plex Mono. Accent (stamp moments only): Special Elite.

## Invite system — token model
Invite generation, scanning, gated registration, the onboarding gate,
and the invite tree are built — see docs/designdoc.md §9 (Phase 2) for
the checklist. Current token model: single-use, expires after
`INVITE_EXPIRY_MINUTES` (src/lib/invites.ts, currently 5 min), enforced
server-side in `redeem_invite`/`invite_lookup_status` (db/schema.sql).
Still creates a real invite tree via users.invited_by → invites.id. Note
the indirection: `invited_by` points at the *invite row*, not the
inviter's user id directly, so reading "who invited this user" requires
joining through `invites.created_by` — see `get_my_inviter()` (the
inverse of `get_invite_tree()`) in db/schema.sql. Profile (§4.7) surfaces
both directions: your inviter as a highlighted "invited by" card, and
everyone you've invited as a friends-list-style section below it
(src/app/profile/InviteFriends.tsx).

Location-verified tokens (docs/designdoc.md §9 Phase 3) are built:
`invites.lat`/`lng` capture the inviter's device position at generation
time (best-effort — a missing location doesn't block generation), and
the invitee's position is checked against it at registration submit via
the shared proximity capability below. A missing reading on either side
degrades gracefully to expiry-only enforcement rather than blocking the
only path into the app — this was a judgment call, not a spec
requirement, so revisit it if abuse patterns show up in practice.

## Shared location capability
`src/lib/location.ts` (`checkProximity`/`haversineDistanceMeters`) is the
one "is this device physically near this point right now" check per
docs/designdoc.md §6.1 — both invite scanning and "I Was There"
attendance confirmation call it rather than each doing their own
distance/recency math. `src/lib/geolocation-client.ts` wraps the browser
Geolocation API for client components that need to capture a reading.

## Attendance ("I Was There")
The `attendance` table (docs/designdoc.md §6.1) is built and
deliberately independent of `rsvps` — confirming attendance never reads
or writes going/saved, and vice versa. GPS-based confirmation
(`confirmAttendance` in src/app/events/actions.ts) is live.

If location permission is denied or a GPS fix fails, confirmation is
strictly GPS-or-nothing — no manual fallback for the `gps` method
(docs/designdoc.md §10, captain decision). The venue-printed check-in QR
(§3.1, Phase 4) has since shipped as the alternative that decision
anticipated: `confirmAttendance` (src/app/events/actions.ts) takes a
`method: "gps" | "venue_qr"` param, and `venue_qr` skips the
GPS/proximity check entirely — see "Admin & venue claiming/check-in"
below for the full path.

## Event map
Map view (src/app/events/EventMap.tsx) is a core/flagship feature, not
a placeholder or lower-priority phase-1 leftover — see docs/designdoc.md
§4.5 and the note in §3. Built on maplibre-gl with CARTO's free
dark-matter/positron basemaps (no API key required; style swaps with
the dark/light toggle). `EventCard` (src/app/events/EventCard.tsx) is
shared between list and map views so RSVP/save behave identically in
both places; the map expands a pin into that same card in place rather
than navigating away. Both views can jump to the other's matching card
("view on map" from a list card, "view in list" from the map's
expanded card).

maplibre-gl needs its `import.meta.url`-derived tile-loading worker URL
overridden via `setWorkerUrl()` (called at module scope in EventMap.tsx) —
that resolution comes back empty once the module is pulled in through
next/dynamic's code-split chunk under Turbopack, so without the override
the map silently never finishes loading (blank square, no console/network
error, style/sprite/tiles.json all fetch fine). `scripts/copy-maplibre-worker.js`
(runs on every `npm install`) copies the matching worker bundle into
`public/` so that URL is servable; see AGENTS.md's "npm install drift"
note for why this class of bug (works in source, breaks at runtime) needs
a real browser to catch, not just tests/lint/build.

## Landing page & bottom nav
`/home` (src/app/home/page.tsx + HomeBrowser.tsx) *is* the Browse Shows
view — not a "you're in" welcome screen with a link into browsing. It
shows an editorial "TONIGHT" masthead (no personalized greeting) over the
shows list, date-grouped as the user scrolls: today's shows under
"TONIGHT", then a small header per subsequent date ("Wednesday, 8/26" —
see `dateKeyInZone`/`formatDateGroupHeader` in src/lib/dateGrouping.ts,
which bake in the scene time zone once server-side so the client groups
by a plain string key). `/events` now just `redirect()`s to `/home` for
old links/bookmarks — don't add real page logic back there.
`src/components/BottomNav.tsx` is the app-wide bottom nav ("Poster Bar":
flush to the bottom edge, 2px solid ink top border, Anton labels, riso-pink
underline as the active mark — see the nav-landing-direction captain
decision for the full rationale/rejected alternatives). Tabs are Shows /
Map / Profile — Map is EventMap.tsx, not a placeholder; there is no Feed
tab/route. On `/home`, Shows/Map are in-page view state (BottomNav's
`onSelect`) reusing the same focus-jump mechanism EventCard's "view on
map" already used between list/map (`focusedEventId`/`mapFocusNonce`);
Profile always navigates via a real link. From any other route (e.g.
`/profile`), BottomNav falls back to plain links (`/home`,
`/home?view=map`) since it has no local view state to switch there.

## Admin & venue claiming/check-in
Phase 4 (docs/designdoc.md §9). `users.is_admin` is bootstrapped by hand
against the live project (no self-service "grant admin" UI, deliberately)
and gates `/admin` (server-side redirect if not admin — UX only, not the
real boundary) plus every admin RPC internally. Admin-only mutations go
through narrow security-definer RPCs, not broadened RLS policies — same
pattern as `redeem_invite`/`revoke_invite`: `list_pending_venue_claims`/
`approve_venue_claim`/`reject_venue_claim` (db/migrations/0006_venue_claims.sql).

**Venue claiming.** `venue_claims` is a separate table from `venues`, not
a status column on it — a naive owner-scoped `update` policy letting a
user set `venues.owner_id = auth.uid()` directly is exactly the
self-approval bug shape the RPC-not-RLS-update note above warns about.
Covers both "claim an existing unclaimed venue" (`venue_id` set) and
"register a brand-new one" (`venue_id` null, `venue_name`/`venue_address`/
`venue_lat`/`venue_lng` filled instead) — `approve_venue_claim` branches
on that atomically (insert-then-link vs. update-owner). `src/app/venues/
claim/page.tsx` is the self-contained claim/register form; deliberately
no identity-verification UI, per §3.1 — manual human review is the point.

**Venue check-in QR.** Reuses the `invites` table rather than a new one —
`venue_id`/`event_id`/`reusable` columns are null for a normal peer
invite, set for a venue's printed code (`src/app/venues/mine/actions.ts`'s
`getOrCreateCheckinCode`, one reusable code per event via a partial unique
index). `redeem_invite` has a real behavioral fork for `reusable = true`:
it skips the single-use status-flipping `UPDATE` and just re-selects the
row instead, so a printed poster keeps working for every scanner all
show long. **That reusable-branch `select` must table-qualify
`created_by`/`lat`/`lng`** (`select invites.created_by, invites.lat,
invites.lng ...`) — this function's own `RETURNS TABLE` OUT parameters
share those exact names, so an unqualified `select id, created_by, lat,
lng` throws "column reference is ambiguous" at call time in plpgsql. This
shipped broken once and was only caught by actually invoking the RPC
against `lowfreq-dev`, not by reading the SQL — re-verify any future edit
to this function by calling it live, not just reviewing the diff.
`inviteExpiresAt`'s flat 5-minute window doesn't fit a code meant to last
a whole show — `checkinExpiresAt`/`CHECKIN_EXPIRY_HOURS` (src/lib/
invites.ts) give it an event-duration-scoped expiry instead (mirrors
`ATTENDANCE_WINDOW_HOURS`, duplicated rather than imported since src/lib
shouldn't reach into src/app).

`/checkin/[token]` (public, not in `src/proxy.ts`'s `PROTECTED_PATHS` —
the venue's printed QR is scanned by the phone's own camera app with no
session guaranteed) is the printed poster's actual destination, not a
reuse of `ScanCamera.tsx` (which hard-codes a `/signup` redirect
regardless of session state). It branches three ways per §3.1: invalid/
expired code; no session → registration, reusing `RegisterForm`/
`registerWithInvite` as-is (they don't need to know the invite is a venue
code); session present → `confirmCheckinAttendance` redeems the invite
then calls `confirmAttendance(eventId, null, "venue_qr")` directly, no GPS
involved. Redeeming first (rather than trusting the token) is what makes
an expired/revoked venue code stop working here too, the same way it does
for registration.

## Data model notes
- public.users.id is the SAME id as auth.users.id (Supabase Auth), linked
  via a foreign key + trigger (handle_new_user). Never manually insert
  into public.users after signup — the trigger handles it.
- rsvps has independent `going` and `saved` booleans on the same row (not
  a single status enum) — a show can be saved without going, going
  without being saved, or both. No "interested" state; there's no
  separate "saved events" table by design, to avoid an extra join. See
  docs/designdoc.md §6.
- venues.owner_id is nullable — most venues start unclaimed. Claiming one
  (or registering a brand-new one) is a shipped Phase 4 feature — see
  "Admin & venue claiming/check-in" above — but `owner_id` is still only
  ever set via `approve_venue_claim`, never a direct client update.

## Build order
Auth, event browse/RSVP, invite gating, location verification (expiry
enforcement, GPS-checked invites, attendance/"I Was There"), and profile
fields (avatar, handle, bio, music identity — see docs/designdoc.md
§4.7/§4.15 and AGENTS.md's notes on the `users`-mutation RPC pattern and
avatar storage) are all built, including the attendance denied-location
decision (see "Attendance" above). From Phase 4 (§9), admin/venue
claiming and venue check-in QR are built (see "Admin & venue
claiming/check-in" above); check `git log`/open PRs for the status of
Phase 4's other items (user-submitted events, custom event posters). For
what's next, see docs/designdoc.md §9.

Signed-in sessions persist across browser restarts (~90 days) via a
`maxAge` override on the Supabase session cookie — see
`src/lib/supabase/cookie-options.ts` and AGENTS.md's note on
`@supabase/ssr`'s `cookieOptions.maxAge` being a no-op in the installed
version. This does not change how someone gets authenticated in the first
place — the invite gate in "Invite system" above is untouched.

## Copy voice
Blunt, factual, not corporate. "You don't just sign up, someone lets you
in" — states how the product works rather than selling it.