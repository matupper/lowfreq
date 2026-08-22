-- Migrate `rsvps` from a 3-state status ('going' | 'interested' | 'saved')
-- to the design doc's model (docs/designdoc.md §6): an independent
-- `going` boolean plus an independent `saved` boolean on the same row,
-- with no "interested" concept.
--
-- Unlike db/schema.sql, this ALTERs the live table in place and does not
-- drop any data.
--
-- IMPORTANT — 'interested' rows have no unambiguous mapping to the new
-- model (see docs/designdoc.md §6, which only ever describes going/
-- not-going + save; it says nothing about migrating pre-existing
-- 'interested' rows). Rather than silently guessing one of:
--   (a) interested -> not going, not saved (discarded)
--   (b) interested -> not going, saved (treated as a bookmark)
--   (c) interested -> going, not saved
-- this migration refuses to run if any 'interested' rows exist. Decide
-- the mapping first (see the needs-decision raised alongside this
-- change), hand-migrate those specific rows to explicit going/saved
-- values, then re-run this script.
begin;

alter table rsvps add column if not exists going boolean not null default false;
alter table rsvps add column if not exists saved boolean not null default false;

do $$
declare
  interested_count bigint;
begin
  select count(*) into interested_count from rsvps where status = 'interested';
  if interested_count > 0 then
    raise exception
      '% row(s) in rsvps have status=''interested'', which has no unambiguous mapping to the going/saved model — see the comment at the top of this file. Resolve those rows manually before re-running this migration.',
      interested_count;
  end if;
end $$;

update rsvps set going = true where status = 'going';
update rsvps set saved = true where status = 'saved';

alter table rsvps drop constraint if exists rsvps_status_check;
alter table rsvps drop column if exists status;
alter table rsvps add constraint rsvps_going_or_saved_check check (going or saved);

drop function if exists public.event_rsvp_counts(uuid[]);

create or replace function public.event_going_counts(event_ids uuid[])
returns table (event_id uuid, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select event_id, count(*)
  from rsvps
  where event_id = any(event_ids) and going
  group by event_id;
$$;

grant execute on function public.event_going_counts(uuid[]) to authenticated, anon;

commit;
