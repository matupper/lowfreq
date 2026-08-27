-- Phase 4 (docs/designdoc.md §9/§3.1/§4.16): venue check-in QR generation.
-- Reuses the `invites` table per §6.1's sketch rather than a new one —
-- venue-issued codes differ from peer stamps only in being tied to a
-- venue/event and reusable by many scanners instead of consumed once.
--
-- CAPTAIN DECISION (2026-08-26, task
-- lowfreq-phase4-plan-decision-venue-invite-rate-limit): no rate limit,
-- redemption cap, or per-device/time throttle on the reusable code. Do not
-- add any throttling scaffolding to this.
begin;

alter table invites add column if not exists venue_id uuid references venues(id);
alter table invites add column if not exists event_id uuid references events(id);
alter table invites add column if not exists reusable boolean not null default false;

-- At most one reusable code per event — guards the "check for an existing
-- code, else create one" flow in src/app/venues/mine/actions.ts against a
-- double-click race producing two live codes for the same show.
create unique index invites_event_reusable_idx on invites (event_id) where reusable;

-- The existing insert policy only ever checked `created_by = auth.uid()`,
-- which was sufficient while every invite was a peer stamp with no
-- venue_id/event_id to forge. Now that those columns exist, a plain
-- created_by check would let any authenticated user self-issue a
-- "venue check-in code" for a venue/event they don't own. Tightened to
-- also require: a non-null venue_id is a venue the caller owns, and a
-- non-null event_id actually belongs to that venue.
drop policy if exists "users can create their own invites" on invites;
create policy "users can create their own invites" on invites
  for insert with check (
    auth.uid() = created_by
    and (
      venue_id is null
      or exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid())
    )
    and (
      event_id is null
      or exists (select 1 from events e where e.id = event_id and e.venue_id = invites.venue_id)
    )
  );

-- The genuinely tricky part: redeem_invite hard-coded single-use semantics
-- via its one atomic `update ... where status = 'unused'` step, which by
-- design only ever succeeds once. A reusable venue code must never flip to
-- 'used' — it's scanned by many different people over one show. This is a
-- behavioral fork in the app's single most security-critical function, not
-- an additive change: for reusable = true, the status-flipping UPDATE is
-- skipped entirely and the invite's info is returned on every call as long
-- as it's still 'unused' (i.e. not expired/revoked). The lazy
-- expired-flip above it still runs unconditionally for both branches, so a
-- reusable code past its event-scoped expiry (see
-- src/lib/invites.ts:checkinExpiresAt) correctly stops working.
create or replace function public.redeem_invite(invite_token text)
returns table (invite_id uuid, created_by uuid, lat double precision, lng double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
  found_created_by uuid;
  found_lat double precision;
  found_lng double precision;
  is_reusable boolean;
begin
  update invites
  set status = 'expired'
  where token = invite_token
    and status = 'unused'
    and expires_at is not null
    and expires_at <= now();

  select reusable into is_reusable from invites where token = invite_token;

  if is_reusable then
    -- Table-qualified, unlike a bare `select id, created_by, lat, lng`
    -- here — this function's own OUT parameters are named created_by/lat/
    -- lng too (see the RETURNS TABLE clause above), and plpgsql resolves
    -- an unqualified column name against its own variables first. Without
    -- the `invites.` prefix, this throws "column reference ... is
    -- ambiguous" at call time — caught by actually invoking this against
    -- lowfreq-dev, not by reading the SQL.
    select invites.id, invites.created_by, invites.lat, invites.lng
      into found_id, found_created_by, found_lat, found_lng
      from invites
      where token = invite_token and status = 'unused';
  else
    update invites
    set status = 'used', used_at = now()
    where token = invite_token and status = 'unused'
    returning id, invites.created_by, invites.lat, invites.lng
      into found_id, found_created_by, found_lat, found_lng;
  end if;

  if found_id is null then
    return;
  end if;

  return query select found_id, found_created_by, found_lat, found_lng;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated, anon;

-- Peek-only, mirrors invite_location's contract: lets /checkin/[token]
-- (both the no-session registration branch and the session-present
-- attendance branch) learn which event/venue a scanned code belongs to,
-- and whether it's a reusable venue code at all, without consuming
-- anything or requiring a session. Returned regardless of status (unlike
-- invite_location) so the check-in page can show a specific "this code
-- expired" message rather than a bare not-found for an event that just ran
-- long past its window.
create or replace function public.invite_checkin_info(invite_token text)
returns table (event_id uuid, venue_id uuid, reusable boolean)
language sql
stable
security definer
set search_path = public
as $$
  select event_id, venue_id, reusable from invites where token = invite_token;
$$;

grant execute on function public.invite_checkin_info(text) to authenticated, anon;

commit;
