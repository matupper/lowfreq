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

## Invite system — phased, don't build Phase 2 early
- Phase 1 (current/MVP): invite = single-use token, no expiry enforced,
  no location check. Still creates a real invite tree via
  users.invited_by → invites.id.
- Phase 2 (later, don't build yet): tighten to time-limited tokens
  (expires_at) + GPS proximity check at scan time. The schema already
  supports this (expires_at column exists unused in Phase 1) — this is
  meant to be a tightening of existing checks, not a rewrite.

## Data model notes
- public.users.id is the SAME id as auth.users.id (Supabase Auth), linked
  via a foreign key + trigger (handle_new_user). Never manually insert
  into public.users after signup — the trigger handles it.
- rsvps.status covers going/interested/saved — there's no separate
  "saved events" table by design, to avoid an extra join.
- venues.owner_id is nullable — most venues start unclaimed; "claiming"
  a venue is a later feature, not MVP.

## Build order (don't jump ahead)
1. Basic email/password auth (done or in progress)
2. Event browse (map/list) + RSVP — core loop, no invite dependency
3. Invite creation + QR generation for existing users
4. Invite scan + gated registration (built last — depends on 1-3)

## Copy voice
Blunt, factual, not corporate. "You don't just sign up, someone lets you
in" — states how the product works rather than selling it.