-- Migrate `rsvps` from a 3-state status ('going' | 'interested' | 'saved')
-- to the design doc's model (docs/designdoc.md §6): an independent
-- `going` boolean plus an independent `saved` boolean on the same row,
-- with no "interested" concept.
--
-- Unlike db/schema.sql, this ALTERs the live table in place and does not
-- drop any data.
--
-- Captain decision on legacy 'interested' rows (docs/designdoc.md §6 does
-- not itself specify a mapping, since it only ever describes going/
-- not-going + save): map interested -> going, not saved.
begin;

alter table rsvps add column if not exists going boolean not null default false;
alter table rsvps add column if not exists saved boolean not null default false;

update rsvps set going = true where status = 'going';
update rsvps set saved = true where status = 'saved';
update rsvps set going = true where status = 'interested';

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
