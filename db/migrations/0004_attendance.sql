-- Phase 3 (docs/designdoc.md §6.1, §9): records a confirmed "I Was There",
-- kept deliberately separate from `rsvps` — going and actually-having-gone
-- are different facts and neither should overwrite the other (someone can
-- RSVP going and not show, or show up without ever RSVPing).
--
-- Adds a new table only — no changes to existing tables/data.
begin;

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  event_id uuid references events(id) not null,
  confirmed_at timestamptz not null default now(),
  method text not null check (method in ('gps', 'venue_qr')),
  unique (user_id, event_id)
);

create index if not exists attendance_event_id_idx on attendance (event_id);

alter table attendance enable row level security;

create policy "users can view their own attendance" on attendance
  for select using (auth.uid() = user_id);

-- The proximity + "has the event actually started" checks that make a
-- confirmation meaningful happen in the app layer (src/app/events/actions.ts,
-- against the shared check in src/lib/location.ts) before this insert is
-- attempted — this policy is the RLS backstop that a user can only ever
-- confirm attendance as themselves, not the source of truth for whether
-- the confirmation is legitimate.
create policy "users can confirm their own attendance" on attendance
  for insert with check (auth.uid() = user_id);

commit;
