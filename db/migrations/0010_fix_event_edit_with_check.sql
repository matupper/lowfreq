-- 0008_event_posters.sql's "hosts can edit their own unapproved events" policy
-- was already applied to lowfreq-dev before its with-check clause was
-- tightened in-file (that edit only affects a fresh full recreate from
-- db/schema.sql, not the live database) — see AGENTS.md's "Deploying db/
-- changes" note on committed migrations vs. what's actually live. Without
-- this, a host could self-approve their own pending event via a raw update
-- (using passed on the pending row, with check only required host_id).
-- This migration applies the same fix live.

begin;

alter policy "hosts can edit their own unapproved events" on events
  with check (auth.uid() = host_id and status in ('pending', 'rejected'));

commit;
