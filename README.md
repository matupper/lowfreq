# lowfreq

An invite-only app for connecting with a local underground music scene.
Browse nearby shows, RSVP with a headcount, save what you're into. The
one thing you can't do is sign yourself up.

## The idea

Open event-discovery apps — Bandsintown, Songkick, Ticketmaster, even
Instagram — flatten "local basement show" and "arena tour" into the same
feed. That works against the culture it's supposed to represent.
Underground scenes stay underground partly *because* access isn't
frictionless: you hear about a show from someone, not an algorithm.

lowfreq reproduces that on purpose. **You cannot register on your own.**
An existing member has to invite you in person, via a stamped QR code —
generated on their phone, scanned on yours, both of you standing in the
same place when it happens. That's not a growth gimmick or a launch-week
gate to remove later; it's the actual product. Every friction decision
(expiry windows, GPS checks) gets judged against whether it preserves
that "someone let you in" feeling, not against conversion metrics.

## What's built

**Auth & onboarding**
- Email/password auth (Supabase Auth)
- Onboarding gate as the only entry point for new accounts — no open
  signup form exists anywhere in the app

**Invite-only registration**
- Any member can generate a single-use, stamp-styled invite QR from
  their profile
- Camera-based scanning redeems the invite and pre-fills registration
- Invites expire 5 minutes after generation, enforced server-side
- Each member's profile shows their invite tree — who they let in

**Location-verified invites**
- Invite generation captures the inviter's GPS position (best-effort —
  a missing reading doesn't block generation)
- Redeeming an invite checks the invitee's device is actually near where
  it was generated, not just that the token is valid and unexpired
- A missing location reading on either side degrades to expiry-only
  enforcement rather than blocking the only path into the app

**Events**
- Browse nearby shows, view event detail (venue, time, description,
  live headcount)
- RSVP (going) and Save are independent — a show can be saved without
  going, going without being saved, both, or neither

**"I Was There"**
- After an event, confirm you actually attended using the same GPS
  proximity check built for invites
- If location is denied or a GPS fix fails, confirmation just doesn't
  happen — there's no manual fallback. That's deliberate: a typed-in
  "I was there" claim isn't worth what a GPS-checked one is.

None of this is mocked up — auth, RSVP, invite generation/scanning,
gated registration, and GPS verification are all live, server-enforced
code paths. See `docs/designdoc.md` §9 for what's shipped (Phases 0–3)
versus what's still ahead (venue-run events, bands, forum, etc. — Phase
4 onward, not built).

## Visual language

Reference point is physical show ephemera — xeroxed flyers, riso zine
covers, wrist stamps at the door — deliberately *not* early-internet
nostalgia (no tiled backgrounds, no blink tags, no glitter cursors; that
reads as costume, not culture). Flyer/event cards get a slight -1° to 1°
rotation; buttons and body text never rotate. Dashed/perforated dividers
stand in for hard rules where it fits. The ink-stamp visual and Special
Elite typeface are reserved for exactly one moment — invite/attendance
verification — and don't show up anywhere else. Dark mode is the
default theme, not an afterthought, and never pure black.

Display type is Anton (all-caps by design), body is Inter, metadata and
timestamps are set in IBM Plex Mono.

## Stack

- **Frontend/backend:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS v4, custom design tokens (see
  `src/app/globals.css`)
- **Database/auth:** Supabase (Postgres + Auth, RLS enabled)
- **Map:** maplibre-gl with CARTO's free basemaps (no API key needed)
- **Hosting:** Vercel (frontend) + Supabase (database)

## Running it locally

1. Install dependencies:
   ```
   npm install
   ```

2. Create a free project at [supabase.com](https://supabase.com).

3. In the Supabase SQL editor, run `db/schema.sql` to create the tables,
   then anything in `db/migrations/` in order.

4. Create `.env.local` in the repo root with your Supabase project URL
   and anon key (Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Run the dev server:
   ```
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

A fresh database has no invites, so the onboarding gate has nothing to
scan yet — seed a first user directly in Supabase (or via SQL) to get an
initial invite tree started.

## Project structure

```
src/
  app/            Routes (App Router) — pages, layouts, server actions
  components/     Shared UI components
  lib/            Supabase client, invite logic, location/geolocation
db/
  schema.sql      Postgres schema — run this first in Supabase
  migrations/     Schema changes applied after the base schema
docs/
  designdoc.md    Product vision, data model, phased build plan
  style-guide.html  Full visual style guide (palette, type, motif rules)
```

## Design system

Colors, type, and spacing are CSS custom properties in
`src/app/globals.css`, exposed to Tailwind via `@theme inline` — classes
like `bg-surface`, `text-kraft`, or `font-display` are available
everywhere. Dark mode is the default theme; light mode is a fully
supported alternate, toggled via the `data-theme` attribute on `<html>`
(see `src/components/ThemeToggle.tsx`). `docs/style-guide.html` has the
full palette, type specimens, and motif usage rules.

## Testing

```
npm test
```

Vitest, with React Testing Library for component tests.

## Deploying

- **Frontend:** push this repo to GitHub, then import it in
  [Vercel](https://vercel.com) — it auto-detects Next.js. Add the same
  two env vars from `.env.local` in the Vercel project settings.
- **Database:** already live once you've run the schema in Supabase; no
  separate deploy step.
