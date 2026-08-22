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

## Invite system — token model, don't tighten early
Invite generation, scanning, gated registration, the onboarding gate,
and the invite tree are built — see docs/designdoc.md §9 (Phase 2) for
the checklist. Current token model: single-use, no expiry enforced, no
location check. Still creates a real invite tree via
users.invited_by → invites.id.

Location-verified, time-limited tokens (docs/designdoc.md §9 Phase 3)
are the next tightening — don't build yet. The schema already supports
this (expires_at column exists, unused for now) — this is meant to be a
tightening of existing checks, not a rewrite.

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

## Build order
Auth, event browse/RSVP, and invite gating (generation, scanning, gated
registration, onboarding gate, invite tree) are all built. For what's
next, see docs/designdoc.md §9 (Phase 3 onward).

## Copy voice
Blunt, factual, not corporate. "You don't just sign up, someone lets you
in" — states how the product works rather than selling it.