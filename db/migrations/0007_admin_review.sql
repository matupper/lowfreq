-- Phase 4 Track A, item 2 (docs/designdoc.md §9): admin review queue
-- skeleton. Adds the is_admin flag and the narrow security-definer RPCs an
-- admin screen needs to list/approve/reject pending events. No self-service
-- grant-admin path — admins are bootstrapped with a one-off
-- `update users set is_admin = true where id = '<uuid>'` run directly
-- against the live project (service-role/dashboard), matching the plan
-- reference's explicit call to not build that UI in Phase 4.
--
-- Numbered after 0006_event_submission.sql (not before, despite Track A's
-- own step order building this admin skeleton first): these RPCs filter on
-- e.status = 'pending', which requires the events.status column that
-- migration adds. Migrations must still apply cleanly in filename order on
-- a fresh database, so schema dependency order wins over task-step order.
--
-- Deliberately no RLS update policy exposing is_admin to `authenticated` —
-- same reasoning as every other users mutation (see AGENTS.md's "Mutating
-- specific users columns" note): a narrow RPC pattern, not a broadened
-- policy. approve_event/reject_event/list_pending_events check
-- `is_admin` internally rather than relying on RLS at all, since the
-- underlying `events` table has no admin-aware select/update policy (and
-- won't — the review queue is meant to bypass "approved events only"
-- entirely, which a table-wide policy can't express safely alongside the
-- normal public read).

begin;

alter table users add column is_admin boolean not null default false;

create or replace function public.list_pending_events()
returns table (
  event_id uuid,
  title text,
  venue_name text,
  host_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, v.name, u.name, e.created_at
  from events e
  join venues v on v.id = e.venue_id
  join users u on u.id = e.host_id
  where e.status = 'pending'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  order by e.created_at asc;
$$;

grant execute on function public.list_pending_events() to authenticated;

create or replace function public.approve_event(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update events set status = 'approved'
  where id = target_event_id and status = 'pending'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.approve_event(uuid) to authenticated;

create or replace function public.reject_event(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update events set status = 'rejected'
  where id = target_event_id and status = 'pending'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.reject_event(uuid) to authenticated;

commit;
