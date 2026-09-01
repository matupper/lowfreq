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
strictly GPS-or-nothing — no manual fallback (docs/designdoc.md §10,
captain decision). This was chosen deliberately, not a stopgap to
revisit casually: revisit specifically once the venue-printed check-in
QR (§3.1, Phase 4) ships, since that gives bad-signal venues (e.g. a
basement show) a real alternative confirmation path
(`attendance.method = 'venue_qr'`) without weakening what a GPS-based
confirmation claims to verify.

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
expanded card). `EventCard` also renders a host-uploaded poster
(`events.poster_url`, docs/designdoc.md §9 Phase 4 item 3) as the
card's header image when present, falling back to today's pure-text
treatment when absent — shared automatically by both views since it's
the one component.

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

## Data model notes
- public.users.id is the SAME id as auth.users.id (Supabase Auth), linked
  via a foreign key + trigger (handle_new_user). Never manually insert
  into public.users after signup — the trigger handles it.
- rsvps has independent `going` and `saved` booleans on the same row (not
  a single status enum) — a show can be saved without going, going
  without being saved, or both. No "interested" state; there's no
  separate "saved events" table by design, to avoid an extra join. See
  docs/designdoc.md §6.
- venues.owner_id is nullable — most venues start unclaimed; "claiming"
  a venue is a later feature, not MVP.
- events.status (pending/approved/rejected, default approved) gates the
  public feed — src/app/home/page.tsx's query filters on it explicitly
  rather than relying on RLS alone, since RLS's own-row exception for a
  host would otherwise leak their pending submission into their normal
  feed. users.is_admin is a plain boolean checked internally by
  list_pending_events/approve_event/reject_event (db/schema.sql), not
  exposed via RLS — see docs/designdoc.md §9 Phase 4.

## Build order
Auth, event browse/RSVP, invite gating, location verification (expiry
enforcement, GPS-checked invites, attendance/"I Was There"), and profile
fields (avatar, handle, bio, music identity — see docs/designdoc.md
§4.7/§4.15 and AGENTS.md's notes on the `users`-mutation RPC pattern and
avatar storage) are all built, including the attendance denied-location
decision (see "Attendance" above). Phase 4 Track A — user-submitted
events, an admin review queue (`/admin`, no BottomNav entry), and
custom event poster upload — is also built (docs/designdoc.md §9 Phase
4, §4.12/§4.12a). For what's next, see docs/designdoc.md §9.

Signed-in sessions persist across browser restarts (~90 days) via a
`maxAge` override on the Supabase session cookie — see
`src/lib/supabase/cookie-options.ts` and AGENTS.md's note on
`@supabase/ssr`'s `cookieOptions.maxAge` being a no-op in the installed
version. This does not change how someone gets authenticated in the first
place — the invite gate in "Invite system" above is untouched.

## Copy voice
Blunt, factual, not corporate. "You don't just sign up, someone lets you
in" — states how the product works rather than selling it.