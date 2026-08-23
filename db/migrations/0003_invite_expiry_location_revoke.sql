-- Phase 3 (docs/designdoc.md §9): enforces the expires_at column that has
-- existed since Phase 1 but was never checked, adds the inviter's
-- generation-time coordinates so a scan-time GPS proximity check can be
-- run against the shared capability in src/lib/location.ts, and adds a
-- 'revoked' status so a member can void a stamp before anyone redeems it.
--
-- Alters the live `invites` table in place — no data is dropped.
begin;

alter table invites
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table invites drop constraint if exists invites_status_check;
alter table invites add constraint invites_status_check
  check (status in ('unused', 'used', 'expired', 'revoked'));

-- Replaces check_invite: same peek-only contract (no side effects, safe to
-- call before a real redeem), but returns which of several reasons a token
-- is unusable so the UI can say "this expired" instead of a generic
-- "invalid" for every case (docs/designdoc.md §9 Phase 3 edge cases).
-- Returns one of: 'unused' (redeemable), 'used', 'expired', 'revoked',
-- 'not_found'. A stable read, so a token that's actually past its
-- expires_at but still stored as 'unused' is reported as 'expired' here
-- without writing anything — the lazy flip happens in redeem_invite below,
-- the one place a real attempt to use it happens.
create or replace function public.invite_lookup_status(invite_token text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  found_status text;
  found_expires_at timestamptz;
begin
  select status, expires_at into found_status, found_expires_at
  from invites where token = invite_token;

  if found_status is null then
    return 'not_found';
  end if;

  if found_status = 'unused' and found_expires_at is not null and found_expires_at <= now() then
    return 'expired';
  end if;

  return found_status;
end;
$$;

grant execute on function public.invite_lookup_status(text) to authenticated, anon;

drop function if exists public.check_invite(text);

-- Peek-only: returns the inviter's generation-time coordinates for a still-
-- redeemable invite, so a scan-time GPS check can be run before actually
-- consuming the token. Returns null lat/lng (not an error) if the inviter's
-- device didn't have a location when they generated it — callers treat
-- that as "no proximity check possible for this invite" rather than a
-- hard failure, since Phase 3 is meant to tighten Phase 2's guarantee, not
-- regress it for invites generated without location access.
create or replace function public.invite_location(invite_token text)
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select lat, lng from invites
  where token = invite_token
    and status = 'unused'
    and (expires_at is null or expires_at > now());
$$;

grant execute on function public.invite_location(text) to authenticated, anon;

-- Atomically marks an invite used — same race-safety contract as before
-- (a single UPDATE ... WHERE status = 'unused'), now also refusing (and
-- lazily flipping to 'expired') a token whose expires_at has passed, so an
-- abandoned expired stamp doesn't sit around readable as "unused" forever.
-- Also returns the stored lat/lng so the caller can run the same
-- proximity check it already ran via invite_location — redone here rather
-- than trusted from that earlier peek, since redeem is the atomic
-- boundary that actually matters.
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
begin
  update invites
  set status = 'expired'
  where token = invite_token
    and status = 'unused'
    and expires_at is not null
    and expires_at <= now();

  update invites
  set status = 'used', used_at = now()
  where token = invite_token and status = 'unused'
  returning id, invites.created_by, invites.lat, invites.lng
    into found_id, found_created_by, found_lat, found_lng;

  if found_id is null then
    return;
  end if;

  return query select found_id, found_created_by, found_lat, found_lng;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated, anon;

-- Lets the creator void a stamp before anyone's redeemed it (they
-- generated it by mistake, or handed it out and changed their mind).
-- Narrow on purpose: only the creator, and only while still 'unused' — a
-- single UPDATE ... WHERE so a concurrent redeem and revoke can't both
-- "win", same pattern as redeem_invite.
create or replace function public.revoke_invite(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update invites
  set status = 'revoked'
  where id = target_invite_id and created_by = auth.uid() and status = 'unused'
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.revoke_invite(uuid) to authenticated;

-- get_invite_tree now also returns expires_at so the profile screen can
-- compute effective status (see src/lib/invites.ts effectiveInviteStatus)
-- instead of trusting a status column that only flips lazily.
create or replace function public.get_invite_tree()
returns table (
  invite_id uuid,
  token text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  invitee_id uuid,
  invitee_name text,
  invitee_joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.token, i.status, i.expires_at, i.created_at, u.id, u.name, u.created_at
  from invites i
  left join users u on u.invited_by = i.id
  where i.created_by = auth.uid()
  order by i.created_at desc;
$$;

grant execute on function public.get_invite_tree() to authenticated;

commit;
