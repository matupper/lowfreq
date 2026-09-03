-- Phase 4 item 6 (docs/designdoc.md §9): basic reporting for
-- already-approved events. Venue reporting is out of scope for the UI in
-- this pass — there's no venue detail/management page yet to hang a report
-- affordance on, the same gap items 4/5 flagged — but the schema still
-- supports target_type = 'venue' so that page can wire straight into this
-- table later instead of needing its own migration.
--
-- Polymorphic target_type/target_id trades away a real FK (integrity is an
-- app-layer check at insert time — see fileReport in
-- src/app/events/actions.ts, which confirms the event exists before
-- inserting) for one table instead of event_reports/venue_reports
-- duplicates. Same admin-only-read posture as venue_claims: no select
-- policy for regular users, admin access goes through the
-- list_open_reports/resolve_report/dismiss_report RPC trio (same pattern as
-- list_pending_events/approve_event/reject_event and
-- list_pending_venue_claims/approve_venue_claim/reject_venue_claim).
begin;

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) not null,
  target_type text not null check (target_type in ('event', 'venue')),
  target_id uuid not null,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table reports enable row level security;

create policy "users can file reports" on reports
  for insert with check (auth.uid() = reporter_id);
-- No select policy for regular users — reports aren't readable by anyone
-- but admins, via the RPCs below.

create or replace function public.list_open_reports()
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  target_label text,
  reporter_id uuid,
  reporter_name text,
  reason text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.target_type,
    r.target_id,
    case r.target_type
      when 'event' then (select e.title from events e where e.id = r.target_id)
      when 'venue' then (select v.name from venues v where v.id = r.target_id)
    end,
    r.reporter_id,
    u.name,
    r.reason,
    r.created_at
  from reports r
  join users u on u.id = r.reporter_id
  where r.status = 'open'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  order by r.created_at asc;
$$;

grant execute on function public.list_open_reports() to authenticated;

create or replace function public.resolve_report(target_report_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update reports set status = 'resolved', reviewed_at = now()
  where id = target_report_id and status = 'open'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.resolve_report(uuid) to authenticated;

create or replace function public.dismiss_report(target_report_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update reports set status = 'dismissed', reviewed_at = now()
  where id = target_report_id and status = 'open'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.dismiss_report(uuid) to authenticated;

commit;
