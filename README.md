# lowfreq

An invite-only app for connecting with your local underground music scene.
Browse nearby shows on a map, RSVP with a headcount, and get in only through
someone who's already inside.

## Stack

- **Frontend/backend:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS v4, custom design tokens (see `src/app/globals.css`)
- **Database/auth:** Supabase (Postgres)
- **Hosting:** Vercel (frontend) + Supabase (database)

## Getting started

1. Install dependencies:
   ```
   npm install
   ```

2. Create a free project at [supabase.com](https://supabase.com).

3. In the Supabase SQL editor, run `db/schema.sql` to create the tables.

4. Copy `.env.example` to `.env.local` and fill in your Supabase project URL
   and anon key (found under Project Settings > API):
   ```
   cp .env.example .env.local
   ```

5. Run the dev server:
   ```
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/            Routes (App Router) — pages and layouts
  components/     Shared UI components
  lib/            Supabase client and other utilities
db/
  schema.sql      Postgres schema — run this in Supabase to set up tables
```

## Design system

Colors, type, and spacing are defined as CSS custom properties in
`src/app/globals.css` and exposed to Tailwind via `@theme inline`, so
classes like `bg-surface`, `text-kraft`, or `font-display` are available
everywhere. Dark mode is the default theme; light is a fully supported
alternate toggled via the `data-theme` attribute on `<html>` (see
`src/components/ThemeToggle.tsx`). The full visual style guide (palette,
type specimens, component patterns, motif rules) lives outside this repo —
keep it as your design reference.

## Roadmap

- [x] Project scaffold, design tokens, dark mode
- [ ] Supabase auth wired to the `users` table
- [ ] Invite creation + QR generation for existing users
- [ ] Invite scanning + registration flow
- [ ] Event map view (browse nearby shows)
- [ ] Event detail + RSVP
- [ ] Venue creation for venue owners
- [ ] Phase 2: time-limited invites + location-verified scanning

## Deploying

- **Frontend:** push this repo to GitHub, then import it in
  [Vercel](https://vercel.com) — it will auto-detect Next.js. Add the same
  two env vars from `.env.local` in the Vercel project settings.
- **Database:** already live once you've run the schema in Supabase; no
  separate deploy step needed for MVP.
