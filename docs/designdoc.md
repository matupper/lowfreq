# lowfreq — design document

*Last updated: working draft, MVP scoping stage*

---

## 1. Vision

lowfreq is an invite-only app for connecting with a local underground
music scene. It solves a specific problem: open event-discovery apps
(Bandsintown, Songkick, Ticketmaster, even Instagram) flatten "local
underground show" and "arena tour" into the same feed, which works
against the culture they're trying to represent. Underground scenes
stay underground partly *because* access isn't frictionless — you hear
about a basement show from someone, not an algorithm.

lowfreq's core mechanic reproduces that: **you cannot register on your
own.** An existing member has to invite you in person, via a scannable
stamp. Everything else — browsing shows, RSVPing, eventually posting
your own events or registering a venue — sits on top of that gated
foundation.

## 2. Core principles

These are the guardrails that keep feature decisions consistent as the
app grows:

- **Invite-gating is the product, not a growth gimmick.** Every
  decision about friction (expiry, location-checking, manual entry
  fallback) should be judged against whether it preserves the "someone
  let you in" feeling, not just against conversion metrics.
- **Ship the lightweight version before the strict version.** Phase 1
  invite-gating (single-use token, no proof of physical presence) is
  intentionally incomplete — that's scoping discipline, not an
  oversight. Phase 2 (expiring tokens + GPS proximity) is a real
  commitment, not a "nice to have someday."
- **The visual language is analog-DIY, not early-internet.** Flyers,
  zines, ticket stubs, ink stamps — not GeoCities. See the separate
  style guide for the full system; the short version is: paper, ink,
  restraint.
- **User-run, eventually.** MVP data (events, venues) can be
  admin-seeded. The long-term shape of the app has members posting
  their own shows and venues registering themselves — every schema and
  permission decision should keep that door open even if it's not
  built yet.
- **Two kinds of "let in," both physical.** Peer invites (a person
  scans you in) and venue invites (a printed code at a real show) are
  different mechanisms but the same underlying rule: you had to
  actually be somewhere, with someone or something real, to get in.
  Neither should become something that works from behind a screen.

## 3. Feature scope

### MVP (build first)
| Feature | Description |
|---|---|
| Email/password auth | Standard signup/login via Supabase Auth |
| Invite-gated registration | New accounts require a valid invite token |
| Invite generation | Any member can generate a single-use invite (QR + fallback code) |
| Invite scanning | Camera-based QR scan to redeem an invite and start registration |
| Event browse (map) | See nearby events plotted on a map |
| Event browse (list) | Same events as a scrollable list, sortable by date/distance |
| Event detail | Full info for a single event: venue, time, description, headcount |
| RSVP (Going) | Binary — you're going or you're not, no in-between state; contributes to a public headcount |
| Save event | Bookmark a show to keep track of, independent of whether you've RSVP'd |
| Profile | View your own invite tree (who you invited), your going/saved shows |
| Dark/light theme toggle | Dark is default; persisted per user |

*Note: the map view was originally sequenced as "build the list first,
map second, whenever there's time" (see Phase 1 in the development
plan). The captain has since redirected priority on this — the map is a
core/flagship feature, not a lower-priority leftover, since nearby pins
are the thing that visually sells the "local scene" concept. See §4.5
and Phase 1 for the current spec and status.*

### Phase 2 (after MVP is stable)
| Feature | Description |
|---|---|
| Strict invites | Tokens expire quickly (e.g. 5 minutes) after generation |
| Location-verified invites | Scan only succeeds if inviter/invitee GPS positions are close |
| "I Was There" attendance | Confirms real attendance at a past event, using the same location-verification capability built for invites |
| Push/email notifications | Reminders for RSVP'd shows, new events from followed venues |

*Note: location-verified invites and "I Was There" both need the same
underlying capability — confirming a device's GPS position is close to
a known point within a time window. Worth building this once as a
shared piece rather than twice as two one-off features (see Phase 3 in
the development plan).*

### Future / not yet scoped in detail
- User-submitted events (any member can post a show, not just admins)
- Venue registration and venue-owned accounts (claim a venue, manage its events)
- Following artists or venues
- Comments or a lightweight social layer on events
- Reporting/moderation tooling (becomes necessary once posting is open)
- Bands & band pages (detail below)
- Custom event posters (detail below)
- Forum / want-ads board (detail below)
- Fleshed-out user profiles (detail below)
- Venue-printed check-in QR (detail below)
- Streaming "now playing" sharing (detail below)

### 3.1 Future features — detail

**Moderation model — user-posted events & venue claims.** Both decided:
manual admin approval, for both, with no auto-approval tier planned.

- **Events:** every user-submitted event enters as `pending` and
  isn't visible on the feed/map until an admin approves it. Chosen
  over trust-graduated auto-approval (e.g. via attendance history)
  for simplicity now — the scene is small enough that this isn't a
  bottleneck yet. Worth revisiting only if/when review volume actually
  becomes a problem, not preemptively.
- **Venues:** venue claims (§3.1 below) are manually approved by an
  admin, and this is meant to be the permanent answer, not a stopgap —
  the number of real venues in any local scene is naturally small, so
  this probably never needs to scale into automated verification the
  way user growth might. Formal business-verification methods (mailed
  codes, business email/domain) were explicitly ruled out, since a lot
  of real DIY venues have neither — manual human review is actually a
  better fit for this app's reality, not just the cheapest option.

**Bands & band pages.** A Band is its own entity, not just a tag on a
user. Any member can create one and invite other members to join it —
this reuses the "invite someone in" pattern from account onboarding
conceptually, but it's a separate flow (inviting someone to a band
doesn't require an in-person stamp scan, since they're already a
member of the app). A band page shows its members, links out to
streaming platforms (Spotify, Bandcamp, etc.) and performance videos,
and — the payoff for the whole feature — bands can be attached to
events as performers. An event can list multiple bands; a band can
play multiple events. This is the foundation for the app eventually
being a real map of who's playing with whom, not just a list of dates.

**Custom event posters.** People already make posters for their own
shows and post them elsewhere — this lets that same image become the
actual event card in the app instead of a generated placeholder. When
creating or editing an event, the host can optionally upload an image;
if present, it replaces the default flyer-card treatment as the
thumbnail/header for that event everywhere it appears (feed, detail,
shared links). This is a genuinely good fit for the visual language,
since it means real ephemera literally becomes the UI instead of just
inspiring it — worth designing the card component so an uploaded
poster slots in cleanly alongside the generated version rather than
looking like two different card types.

**Forum / want-ads board.** A board for finding people to join or fill
out a band — mirrors the analog version of this (a flyer stapled to a
telephone pole with tear-off tabs listing a phone number) more than it
mirrors a typical web forum. There's a real opportunity here to carry
the physical metaphor further than anywhere else in the app: posts
could visually resemble a torn flyer, and contact info could be
revealed a limited number of times ("tabs") rather than sitting there
permanently and anonymously scrapable, similar to how a real flyer's
tabs eventually run out. Needs real moderation thinking once it's
scoped in detail, since it's the first place strangers are directly
exchanging contact information.

**Fleshed-out profiles.** MVP profile is functional (invites, RSVPs).
The later version adds identity: instruments played, favorite
bands/albums, a short bio — the things that make a profile feel like a
person's page rather than an account settings screen. This likely
warrants its own small set of tables (or structured fields) rather
than free text, so instruments/favorites can eventually be
cross-referenced (e.g. "drummers near you," though that's speculative
and not scoped).

**Venue-printed check-in QR.** A venue generates one printed,
reusable QR code per event and physically posts it at the show — a
digital version of the flyer-on-a-pole. Unlike a personal invite stamp
(single-use, given by one person to one person), this code is scanned
by many different people over the course of one show, and it behaves
differently depending on who's scanning:

- **No app installed** → opens the app store listing.
- **App installed, not registered** → starts a "venue invite"
  registration — a second, separate path into the app alongside peer
  invites. Still requires physical presence (you had to be at the
  actual show to scan it), which keeps it consistent with the app's
  core principle even though it's not person-to-person.
- **App installed, logged in** → confirms "I Was There" for that
  specific event. This is actually a *better* attendance signal than
  raw GPS in a lot of cases — it doesn't depend on signal strength,
  which matters a lot for basement/warehouse venues where GPS is
  notoriously unreliable (see open questions).

This depends on venues being first-class accounts (already future
scope — see venue registration above), since generating a printed code
tied to a specific event needs a venue identity to generate it from.

**Streaming "now playing" sharing.** Connect a streaming account so
your profile shows what you're actually listening to right now —
the Airbuds idea. Two things make this different from every other
future feature in this doc, worth flagging up front:

- **Platform parity isn't guaranteed.** Spotify's Web API has a real
  currently-playing endpoint built for exactly this. Apple Music's
  public API is much more limited for reading system-wide playback —
  it's built for controlling playback inside your own app, not
  observing what's playing in the Apple Music app itself. This may
  ship Spotify-first with Apple Music added later or not at all,
  rather than both simultaneously — worth deciding once actually
  scoped, not assumed now.
- **This is the first feature holding a live third-party credential.**
  The OAuth token needed to poll "what's playing" is meaningfully more
  sensitive than anything else in the app so far (a favorite-albums
  list is inert; a listening-activity token is live access to someone's
  account). It needs to live in its own tightly-locked table, separate
  from the "now playing" snippet that's actually meant to be public.

Should be opt-in per connection, with an easy, obvious way to pause or
hide it — not just disconnect entirely — since "what I'm listening to"
is exactly the kind of thing someone might want to share generally but
hide for one specific song.

## 4. Screens

Each entry below is a distinct screen/route. "State" notes call out
non-obvious variations worth designing for up front.

### 4.1 Onboarding gate
The first thing anyone sees with no session. Explains the invite-only
premise, offers "scan an invite stamp" (opens camera) and a manual
code-entry fallback. No account creation possible from here without a
valid invite.

- **State:** invalid/expired code entered manually → clear error,
  no account created, offer to try again.

### 4.2 Camera scan
Live camera view with a framing guide for the stamp/QR. On successful
scan, auto-advances to registration pre-filled with the invite token.

- **State:** camera permission denied → fallback prompt pointing to
  manual code entry.

### 4.3 Registration
Username, email, password. Only reachable with a valid (unused,
unexpired) invite token already in hand from 4.1/4.2.

- **State:** token becomes invalid mid-flow (e.g. someone else redeemed
  it first) → explain clearly, send back to the gate rather than
  silently failing.

### 4.4 Login
Standard email/password login for returning users. No invite token
needed here — gating only applies to *new* account creation.

### 4.5 Home / event feed
The default screen after login. Map view of nearby events with a
toggle to switch to list view. Filter by date range at minimum for
MVP; genre/tag filtering can come later once there's enough event
volume to need it.

**Map view is a core/flagship feature** (captain-redirected priority —
see the note in §3), not a secondary/placeholder view: nearby event
pins are the thing that visually sells "here's what's happening around
you." Current spec, as built:
- Venues are plotted as pins on a real map (maplibre-gl + CARTO's free
  dark-matter/positron basemaps — dark by default, swaps with the
  dark/light toggle, no API key required; see the note in §7).
- Tapping a pin expands it **in place** into the same event card
  component used in list view — not a navigation away from the map.
  RSVP (going) and save work directly from that expanded card. A venue
  with multiple shows exposes a small prev/next cycle within the card
  rather than needing repeated pin taps.
- The expanded card has a "view in list" action that switches to list
  view and scrolls to that exact event.
- List view's cards have the reverse action, "view on map" — switches
  to map view, flies the camera to that event's venue, and opens its
  card.
- **State:** no events nearby → don't show an empty map silently;
  explain the app is invite-only/early and sparse by design, rather
  than reading as broken.

### 4.6 Event detail
Full view of one event: title, venue (with map pin), date/time,
description, host, live headcount, RSVP (Going) and Save actions.
*(Future, Phase 2)* once an event has passed, a confirmed attendee sees
an "I Was There" badge here instead of the RSVP button.

### 4.7 Profile
Header shows the identity fields from 4.15 — avatar, handle (or "no
handle yet" if unset), email, and a bio when set — with an "edit
profile" link into 4.15. Below that, an optional "music identity"
block of pill lists (instruments played, favorite artists/albums/songs)
renders only for whichever categories the person actually filled in;
an account with none of it set shows no music-identity section at all,
same "optional fields don't leave visible empty scaffolding" rule as
the bio. Then: your going/saved shows, your invite tree (who you've
invited, whether they've joined), and a way to generate a new invite
stamp to give out. *(Future, Phase 2)* adds a fourth: a record of shows
you were confirmed at ("I Was There"), separate from RSVPs — this is a
history of what actually happened, not of what you planned to do.
*(Future, Phase 6)* adds a now-playing badge if the person has
connected a streaming account and hasn't paused sharing.

### 4.8 Generate invite
Reachable from Profile. Produces a single-use stamp/QR for the member
to show someone in person. Phase 1: no expiry shown. Phase 2: visible
countdown once expiry is implemented.

### 4.9 Settings
Theme toggle (dark default/light), account basics (change password,
log out). Minimal for MVP — this screen grows later, not now.

### 4.10 Band page *(future)*
Public page for a Band: name, member list (linking to each member's
profile), streaming links, performance videos, and a list of upcoming
and past events where the band is listed as a performer.

### 4.11 Create / manage band *(future)*
Name and create a band, invite existing members to join it, edit the
streaming/video links. Band membership needs at least one permission
tier worth deciding later — see open questions.

### 4.12 Event creation / edit *(future)*
Where user-submitted events get built. Includes the optional custom
poster upload (§3.1) — if a host uploads an image, it becomes the
event's card/thumbnail everywhere instead of the generated flyer-card
treatment. Also where bands get attached to an event as performers.
Submitted events enter as `pending` and aren't visible to anyone else
until an admin approves them — the host should see a clear "awaiting
approval" state rather than assuming it's already live.

### 4.12a Admin review queue *(future)*
Not user-facing. A simple internal view listing pending events and
venue claims for approval/rejection. Doesn't need real design
investment early on — a plain table is fine until volume says
otherwise.

### 4.13 Forum board *(future)*
Scrollable board of want-ad-style posts ("looking for a drummer,"
"bassist seeking a band"). Styled closer to a wall of torn flyers than
a typical forum thread list — see §3.1 for the tear-off-tab contact
idea.

### 4.14 Forum post detail *(future)*
A single want-ad: what's being looked for, any relevant details, and
the (rate-limited) contact reveal.

### 4.15 Profile edit
Built. Where the profile-identity fields get set: avatar photo, handle,
bio, instruments played, favorite artists/albums/songs — the last four
optional ("share your music identity"), handle treated as required by
the form even though the underlying column is nullable (see §6). Avatar
uploads to the `avatars` Storage bucket and replaces in place (fixed
per-user filename, cache-busted on the displayed URL) rather than
accumulating one object per upload. Separate from Settings (4.9), which
stays account-mechanics-only.

### 4.16 Venue check-in code *(future)*
Reachable from a venue's own event management view. Generates a
printable, poster-ready QR for a specific event — meant to be printed
and physically displayed at the show. See §3.1 for how the same code
behaves differently depending on who scans it.

### 4.17 Connect streaming account *(future)*
Reachable from Settings or Profile edit. OAuth connect flow per
provider, a pause/hide toggle for the now-playing display, and a
disconnect option that also revokes the stored token, not just stops
showing it.

## 5. Core user flows

**New user, invited in person:**
Existing member generates a stamp (4.8) → shows it to the new person →
new person opens the app for the first time, lands on 4.1 → scans
(4.2) → lands on 4.3 with token pre-filled → completes registration →
lands on 4.5 (home feed).

**Returning user, browsing:**
Login (4.4) → home feed (4.5) → tap an event → detail (4.6) → RSVP or
Save → back to feed.

**Existing member, inviting someone:**
Profile (4.7) → Generate invite (4.8) → show the stamp/QR to the
person in real life → (later, back in Profile) see the new member
appear in their invite tree once registration completes.

## 6. Data model

Full schema lives in `db/schema.sql`. Summary of the six core tables
and why each exists:

- **users** — id matches Supabase `auth.users.id` directly (no
  separate identity record). `invited_by` links back to the `invites`
  row that let them in, forming the invite tree. `handle` (nullable —
  existing accounts predate this field and can't be retroactively
  assigned one, though the edit screen requires one before letting a
  save go through; unique case-insensitively via a `lower(handle)`
  unique index rather than a `citext` column, avoiding an extra
  extension beyond the `pgcrypto` already enabled) and `avatar_url` are
  the two
  profile-identity fields added in Phase 6 (§4.15): they live here
  rather than in `user_profiles` because they're core identity, the
  same tier as `name`, potentially needed anywhere a user is displayed
  (event host, invite tree, a future feed) — not just on the profile
  screen. Both are mutated through narrow security-definer RPCs
  (`set_handle`/`set_avatar_url`) rather than an RLS `UPDATE` policy on
  `users`, since `users` also holds `phone`/`invited_by`/`created_at`
  and RLS can't restrict which *columns* a client changes, only which
  rows — same reasoning as every other narrow mutation RPC below
  (`redeem_invite`, `revoke_invite`, `set_rsvp_going`).
- **invites** — token, status (unused/used/expired/revoked), and an
  `expires_at` column that's unenforced in Phase 1 and enforced in
  Phase 3, along with the `lat`/`lng` columns location verification
  needs (see §9 Phase 3).
- **venues** — `owner_id` is nullable; most MVP venues are unclaimed
  locations, not accounts. Claiming becomes a feature later. *(Future)*
  a claim also carries a `status` (`pending`/`approved`/`rejected`),
  reviewed manually by an admin — permanently, not just for now.
- **events** — belongs to a venue, hosted by a user. *(Future)* gains
  a `status` column (`approved` by default for admin-seeded MVP data,
  `pending`/`approved`/`rejected` once user submission opens) — MVP
  events can default straight to `approved` since only admins create
  them right now, avoiding a migration headache later.
- **rsvps** — a single table with a `status` of going/saved. No
  "interested" state — early scoping had a three-state version, but in
  practice going/not-going with a separate independent Save covers the
  same ground more simply and maps more directly to what the headcount
  actually needs to count.
- **attendance** — records a confirmed "I Was There," kept deliberately
  separate from `rsvps`: `user_id`, `event_id`, `confirmed_at`, and a
  `method` (`gps` or `venue_qr`, though only `gps` is produced until the
  venue check-in QR ships in Phase 4) — going and actually-having-gone
  are different facts and neither should overwrite the other.
- **user_profiles** — **resolves the open question below**: this is
  the "columns on `users` or a separate table" decision. 1:1 with
  `users` (`user_id` primary key), holding `bio` (text, optional) and
  three-plus-one text[] columns — `instruments`, `favorite_artists`,
  `favorite_albums`, `favorite_songs` — arrays rather than jsonb since
  each is a flat list of short strings with no nested structure. Split
  out from `users` rather than added as nullable columns there because
  this content is optional, list-shaped, and (unlike handle/avatar_url
  above) only ever read on the profile screen itself — same shape of
  reasoning as keeping `attendance` separate from `rsvps`. RLS is
  select/insert/update scoped to `auth.uid() = user_id`, same owner-only
  posture as `users` (no other user's bio/instruments/favorites are
  readable yet) — a future public-profile/feed feature should read this
  through its own narrow security-definer accessor rather than loosening
  these policies wholesale, the same posture already used for
  `music_connections`/`now_playing` below.
- **avatars (Storage bucket)** — a public bucket, one object per user at
  `<user_id>/avatar.<ext>` (fixed filename so a re-upload overwrites via
  `upsert` instead of accumulating orphaned objects). Bucket is public
  and has an explicit public `select` policy, since an avatar needs to
  actually render; `insert`/`update`/`delete` are restricted to the
  owning user via the standard Supabase convention of matching the
  first path segment to `auth.uid()::text`.

### 6.1 Future entities (not yet in `schema.sql`)

Sketched here for planning purposes — not final column lists:

- **bands** — name, bio, streaming links, video links.
- **band_members** — join table between `bands` and `users`, likely
  with a role (e.g. member vs. can-manage) once that's decided (see
  open questions).
- **event_performers** — join table between `events` and `bands`, so
  an event can list multiple bands and a band can appear on multiple
  events.
- **events.poster_url** — a new nullable column on the existing
  `events` table for the optional custom poster image. Nullable by
  design: absence means "use the generated flyer-card treatment."
- **forum_posts** — want-ad content, posted by a user, with whatever
  rate-limited contact-reveal mechanism ends up designed for the
  tear-off-tab idea.
- **invites, extended** — venue-issued codes reuse the `invites` table
  rather than becoming a new one, with a couple of differences from
  peer stamps: a `venue_id` (nullable — null means a normal peer
  invite), an `event_id` it's tied to, and a `reusable` flag, since a
  printed poster gets scanned by many people over a show rather than
  once by one person.
- **music_connections** — one row per user per provider: `provider`
  (spotify/apple_music), `access_token`, `refresh_token`,
  `expires_at`, `visible` (the pause/hide toggle). RLS should restrict
  this to the owning user only — tokens never get read by anyone else,
  including via the API a profile page uses.
- **now_playing cache** — a small, separate, publicly-visible record
  (track, artist, artwork URL, `updated_at`) that's what a profile
  actually displays — populated by a server-side call using the token
  above, never by exposing the token itself to the client.

## 7. Tech stack

- **Frontend/backend:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS v4, custom design tokens (see style guide)
- **Auth/database:** Supabase (Postgres + Auth)
- **Hosting:** Vercel
- **Map (event browse):** maplibre-gl, styled with CARTO's free
  dark-matter/positron basemaps — chosen specifically because it needs
  no API key/credential to run. Revisit for a licensed Mapbox/MapTiler
  style (with support behind it) if usage outgrows CARTO's free tier.

## 8. Design system (summary)

Full detail lives in the separate style guide document. Key points
worth repeating here since they affect how screens should be built:

- Dark mode is the **default** theme, not an add-on.
- Display type is Anton (all-caps, condensed, gig-poster). Special
  Elite is reserved for verification/stamp moments only.
- Motifs (slight card rotation, dashed dividers, the stamp visual) have
  a strict usage budget — see the style guide's yes/no rule list before
  adding new "handmade" touches to a screen.

## 9. Development plan

Phased so that each stage produces something demoable and doesn't
depend on a later, harder stage being finished first.

### Phase 0 — Foundation (done)
- [x] Project scaffold (Next.js + Tailwind + Supabase), deployed to Vercel
- [x] Design tokens wired into Tailwind
- [x] Database schema created, auth linked via `handle_new_user` trigger
- [x] RLS enabled with starter policies

### Phase 1 — Core loop (current)
- [ ] Email/password auth (signup/login, no invite gate yet)
- [ ] Seed test venues/events directly in Supabase
- [x] Event feed — list view
- [x] Event feed — map view (originally sequenced "second," but
      captain-redirected to a core/flagship feature — see §3, §4.5:
      real pin map, tap-to-expand event card with inline RSVP/save, and
      a two-way jump to/from the matching list-view card)
- [ ] Event detail screen
- [ ] RSVP + Save, writing to `rsvps`
- [x] Profile screen showing a user's own RSVPs/saves

**Milestone:** a logged-in user can browse real seeded events and RSVP.
Demoable, even without the invite system working yet.

### Phase 2 — Invite gating (MVP-complete, done)
- [x] Invite generation screen + QR rendering (stamp-styled)
- [x] Camera scan flow
- [x] Registration flow gated behind a valid, unused invite token
- [x] Onboarding gate screen (replaces open signup as the default entry point)
- [x] Invite tree visible on Profile

**Milestone:** the app is now actually invite-only end to end — this is
the MVP.

### Phase 3 — Location verification (invites + attendance)
- [x] Build the shared "is this device near this point right now"
      capability once — both features below consume it (src/lib/location.ts)
- [x] Add `expires_at` enforcement (short-lived invite tokens)
- [x] Add GPS proximity check at invite scan time
- [x] `attendance` table + "I Was There" confirmation flow at events
- [x] Handle edge cases: expired token UX, revoking an unused invite,
      and location permission denied/GPS failure for attendance (see §10)

### Phase 4 — Opening up posting
- [ ] User-submitted events (currently admin/seed-only), entering as
      `pending` and invisible to others until approved
- [ ] Simple internal admin review queue for pending events + venue claims
- [ ] Custom event poster upload (cheap addition once event creation exists)
- [ ] Venue claiming/registration flow, manually approved by an admin
      (permanent process, not a placeholder for later automation)
- [ ] Venue check-in QR generation (depends on venue accounts above
      *and* the `attendance` table from Phase 3 — don't start before both exist)
- [ ] Basic reporting for already-approved content (separate from the
      pre-approval queue above — this handles things that only become
      a problem after the fact)

### Phase 5 — Bands
- [ ] `bands` + `band_members` tables
- [ ] Create/manage band screen, invite members
- [ ] Band page (public view)
- [ ] `event_performers` join — attach bands to events as performers

### Phase 6 — Profiles & forum
- [x] Fleshed-out profile fields (avatar, handle, bio, instruments,
      favorites) + edit screen (§4.7, §4.15, §6's `user_profiles` /
      `avatars` bucket decision) — avatar and handle weren't in the
      original Phase 6 scope but were added alongside this work per
      captain direction (pivot toward a standard social-app profile)
- [ ] Forum board + post detail
- [ ] Contact-reveal mechanism for forum posts (needs its own scoping pass)
- [ ] Spotify connection + now-playing display (Apple Music: scope
      separately once Spotify version is working — don't assume parity)

### Later / unscoped
- Notifications
- Following artists/venues
- Any social layer beyond RSVP/save
- **Standard social-app navigation shape.** Captain-stated future
  direction, not yet scoped or built: a bottom navbar for switching
  between Profile, a Feed, and future pages, with the landing page
  becoming the existing "Browse Shows" view instead of the current
  "You're In" welcome screen (§4.1/onboarding-adjacent), which the
  captain considers to currently serve no purpose. This profile-fields
  work (§4.7, §4.15) is explicitly the first step toward this pivot,
  not the navbar/landing-page change itself — those are a separate,
  later task.

## 10. Open questions

Things worth deciding before the phase that needs them, not before:

- What happens to a user's invite tree if their inviter is removed?
  Worth deciding before any moderation/ban feature is built, not now.
- For "I Was There": if location permission is denied or a GPS check
  fails for a legitimate reason (e.g. bad signal in a basement venue —
  genuinely plausible for this app), is there a manual fallback, or is
  it strictly GPS-or-nothing? **Decided (Phase 3):** strictly
  GPS-or-nothing, no manual fallback — see `confirmAttendance` in
  src/app/events/actions.ts. Revisit once the venue-printed QR (§3.1,
  Phase 4) ships, since that gives bad-signal venues a real alternative
  confirmation path (`attendance.method = 'venue_qr'`) without weakening
  what a GPS-based "I Was There" claims to verify.
- Venue-issued registration is a real loophole in the exclusivity
  model worth being honest about: a well-attended show could let
  dozens of strangers self-register from one poster in one night,
  which is a very different growth shape than one person inviting
  one person. Worth deciding whether venue invites need any rate
  limit or friction of their own before this ships, not after.
- For streaming now-playing: does the app poll on a timer (needs
  background infrastructure) or fetch live whenever someone views the
  profile (simpler, but the data can be a few minutes stale between
  views)? The second is probably the right MVP answer for this
  feature, but worth confirming before building rather than defaulting
  into whichever is easier mid-implementation.
- Does band membership need permission tiers (e.g. anyone in the band
  can edit the page vs. only whoever created it), or is it flat for
  now? Affects `band_members` schema — worth deciding before Phase 5,
  not before.
- For custom event posters: any size/aspect-ratio constraints, or
  accept anything and crop/contain in the UI? Affects the upload flow
  more than the schema.
- For the forum's contact-reveal idea: how many "tears" per post
  before contact info stops being shown, and does the poster get
  notified when someone reveals it? This is the one feature here that
  most needs a dedicated scoping pass before building — it's also the
  first place strangers exchange contact info directly.
