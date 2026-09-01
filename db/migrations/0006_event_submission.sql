-- Phase 4 Track A, item 1 (docs/designdoc.md §9): user-submitted events.
-- Existing/seeded rows default straight to 'approved' — no backfill of
-- historical rows needed since the column default handles it.
--
-- Replaces the previous blanket public-read policy on `events` with a
-- status-aware one, and adds the first insert policy the table has ever
-- had (there was none before — every existing event was seeded directly).
-- The insert policy's `with check (status = 'pending')` is defense-in-depth
-- against a forged payload: even if a client submits status = 'approved'
-- directly, RLS refuses anything that isn't 'pending'.

begin;

alter table events add column status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));

drop policy "events are publicly readable" on events;

create policy "approved events are publicly readable" on events
  for select using (status = 'approved' or host_id = auth.uid());

create policy "users can submit pending events" on events
  for insert with check (auth.uid() = host_id and status = 'pending');

commit;
