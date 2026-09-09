-- lowfreq — full schema (v4)
-- Safe to re-run: drops existing tables/trigger first, then recreates everything.
-- Run this in the Supabase SQL editor.
--
-- WARNING: this drops and recreates every table, discarding all data. For an
-- existing deployment with real rows to preserve, use
-- db/migrations/0001_rsvp_going_saved.sql instead, which alters the live
-- `rsvps` table in place.

-- ── Clean slate ──────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists reports cascade;
drop table if exists user_profiles cascade;
drop table if exists venue_claims cascade;
drop table if exists attendance cascade;
drop table if exists rsvps cascade;
drop table if exists events cascade;
drop table if exists venues cascade;
drop table if exists invites cascade;
drop table if exists users cascade;

create extension if not exists pgcrypto;

-- ── Tables ───────────────────────────────────────────────────

-- users.id is the SAME id as Supabase's auth.users — no separate identity.
-- handle/avatar_url are the profile-identity fields from docs/designdoc.md
-- §4.15/§6.1 — see db/migrations/0005_profile_fields.sql for the full
-- data-model decision (why these two live on `users` while
-- bio/instruments/favorites live in the separate `user_profiles` table
-- below, why handle is nullable, why case-insensitive uniqueness is a
-- lower(handle) index rather than citext).
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'new user',
  phone text unique,
  handle text,
  avatar_url text,
  invited_by uuid,
  -- Bootstrapped by hand against the live project (no self-service "grant
  -- admin" UI, deliberately) — gates the admin-review RPCs in
  -- db/migrations/0006_venue_claims.sql / 0007_admin_review.sql and the
  -- /admin route.
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint users_handle_format check (handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$')
);

create unique index users_handle_lower_idx on users (lower(handle)) where handle is not null;

create table invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references users(id) not null,
  token text unique not null,
  status text not null default 'unused' check (status in ('unused', 'used', 'expired', 'revoked')),
  expires_at timestamptz,
  -- Inviter's device position at generation time (nullable — a generator
  -- without location access can still make an invite; the scan-time GPS
  -- check just can't run for that one). Compared against the invitee's
  -- position at redeem time via src/lib/location.ts.
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table users
  add constraint users_invited_by_fkey foreign key (invited_by) references invites(id);

create table venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id),
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- status: user-submitted events (docs/designdoc.md §9 Phase 4 item 1) start
-- 'pending' and need admin approval before showing up in the public feed
-- (see the "approved events are publicly readable" policy below and the
-- explicit .eq("status", "approved") filter in src/app/home/page.tsx —
-- RLS's "or host_id = auth.uid()" means a host would otherwise see their
-- own pending submission mixed into their normal feed). Existing/seeded
-- rows default straight to 'approved'.
-- poster_url: nullable — absence keeps the generated flyer-card treatment
-- (see EventCard.tsx). See db/migrations/0008_event_posters.sql.
create table events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) not null,
  host_id uuid references users(id) not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  poster_url text,
  created_at timestamptz not null default now()
);

-- Venue-issued check-in codes (docs/designdoc.md §3.1/§4.16, §9 Phase 4)
-- reuse the `invites` table rather than becoming a new one — venue_id/
-- event_id are null for a normal peer invite, set for a venue's printed
-- code. reusable=true is what makes redeem_invite (below) skip the
-- single-use status flip: a printed poster gets scanned by many people
-- over one show, not once by one person. Added via ALTER rather than
-- inline on invites' own create table above since venues/events don't
-- exist yet at that point in this file.
alter table invites add column venue_id uuid references venues(id);
alter table invites add column event_id uuid references events(id);
alter table invites add column reusable boolean not null default false;

-- At most one reusable code per event — guards the "check for an existing
-- code, else create one" flow in src/app/venues/mine/actions.ts against a
-- double-click race producing two live codes for the same show.
create unique index invites_event_reusable_idx on invites (event_id) where reusable;

-- Going and saved are independent facts about one user/event pair, not a
-- single enum: a show can be saved without going, going without being
-- saved, or both. A row only exists while at least one is true — clearing
-- both deletes the row rather than leaving an inert 0/0 record.
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  event_id uuid references events(id) not null,
  going boolean not null default false,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, event_id),
  check (going or saved)
);

-- A confirmed "I Was There", kept deliberately separate from `rsvps` (see
-- docs/designdoc.md §6.1) — going and actually-having-gone are different
-- facts and neither should overwrite the other.
create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  event_id uuid references events(id) not null,
  confirmed_at timestamptz not null default now(),
  method text not null check (method in ('gps', 'venue_qr')),
  unique (user_id, event_id)
);

-- Optional "music identity" fields (docs/designdoc.md §4.15/§6.1) — bio,
-- instruments, favorites. Kept separate from `users` because this content
-- is list-shaped, optional, and only ever read on the profile screen
-- itself (see db/migrations/0005_profile_fields.sql for the full
-- reasoning). 1:1 with users; a row only exists once someone has actually
-- set at least one of these fields.
create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  bio text,
  instruments text[] not null default '{}',
  favorite_artists text[] not null default '{}',
  favorite_albums text[] not null default '{}',
  favorite_songs text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Venue claiming/registration (docs/designdoc.md §9 Phase 4): covers both
-- "claim an existing unclaimed venue" (venue_id set) and "register a
-- brand-new one" (venue_id null, venue_name/address/lat/lng filled
-- instead). Separate from `venues` rather than a status column bolted on
-- directly — see db/migrations/0006_venue_claims.sql for why a naive
-- owner-scoped update policy on venues itself would be a self-approval bug.
create table venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  claimant_id uuid references users(id) not null,
  venue_name text,
  venue_address text,
  venue_lat double precision,
  venue_lng double precision,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Basic reporting (docs/designdoc.md §9 Phase 4 item 6). Polymorphic
-- target_type/target_id trades a real FK for one table instead of
-- event_reports/venue_reports duplicates — integrity is an app-layer check
-- at insert time (see fileReport in src/app/events/actions.ts). Only event
-- reporting has a UI affordance so far; venue reporting has no detail page
-- to hang one on yet (same gap as items 4/5), but the schema already
-- supports target_type = 'venue'. See db/migrations/0011_reports.sql.
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

-- ── Indexes ──────────────────────────────────────────────────
create index events_start_time_idx on events (start_time);
create index rsvps_event_id_idx on rsvps (event_id);
create index attendance_event_id_idx on attendance (event_id);
create index invites_token_idx on invites (token);

-- ── Auto-create a users row when someone signs up via Supabase Auth ──
-- invite_id in metadata comes from the gated registration flow (redeem_invite
-- runs first and hands its invite id to auth.signUp's metadata); absent for
-- any account created without going through that flow.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, invited_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'new user'),
    nullif(new.raw_user_meta_data->>'invite_id', '')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────
alter table users enable row level security;
alter table invites enable row level security;
alter table venues enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table attendance enable row level security;
alter table user_profiles enable row level security;
alter table venue_claims enable row level security;
alter table reports enable row level security;

create policy "users can view own row" on users for select using (auth.uid() = id);
-- A pending/rejected submission is only visible to its own host — everyone
-- else only ever sees approved events. See
-- db/migrations/0006_event_submission.sql.
create policy "approved events are publicly readable" on events
  for select using (status = 'approved' or host_id = auth.uid());
-- Defense-in-depth: even if a client forges the insert payload, RLS
-- refuses anything that isn't 'pending' — a submission can never land
-- pre-approved.
create policy "users can submit pending events" on events
  for insert with check (auth.uid() = host_id and status = 'pending');
-- Lets a host edit their own submission before it's approved (or after
-- it's rejected) — approved events are locked from owner edits. See
-- db/migrations/0008_event_posters.sql.
create policy "hosts can edit their own unapproved events" on events
  for update using (auth.uid() = host_id and status in ('pending', 'rejected'))
  with check (auth.uid() = host_id and status in ('pending', 'rejected'));
-- Lets createEvent (src/app/events/new/actions.ts) roll back its own insert
-- if the follow-up poster upload fails, so a retry doesn't leave a
-- duplicate pending submission. See db/migrations/0009_event_submission_rollback.sql.
create policy "hosts can delete their own pending submissions" on events
  for delete using (auth.uid() = host_id and status = 'pending');
create policy "venues are publicly readable" on venues for select using (true);
-- venue_id/event_id are only ever non-null for a venue-issued check-in
-- code (see the invites table's comment above) — a plain created_by check
-- was sufficient while every invite was a peer stamp with nothing to
-- forge; now it also requires venue_id to be a venue the caller owns, and
-- a non-null event_id to actually belong to that venue, so an
-- authenticated user can't self-issue a check-in code for a venue/event
-- they don't own.
create policy "users can create their own invites" on invites for insert with check (
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
create policy "users can view their own invites" on invites for select using (auth.uid() = created_by);
create policy "users can submit their own claims" on venue_claims for insert with check (auth.uid() = claimant_id);
create policy "users can view their own claims" on venue_claims for select using (auth.uid() = claimant_id);
-- No select policy for regular users — reports aren't readable by anyone
-- but admins, via list_open_reports/resolve_report/dismiss_report below.
create policy "users can file reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "users can view their own rsvps" on rsvps for select using (auth.uid() = user_id);
create policy "users can create their own rsvps" on rsvps for insert with check (auth.uid() = user_id);
-- Needed so a user can toggle going/saved independently (an upsert on the
-- (user_id, event_id) unique constraint issues an UPDATE on conflict) or
-- clear both, which issues a DELETE.
create policy "users can update their own rsvps" on rsvps for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete their own rsvps" on rsvps for delete using (auth.uid() = user_id);
create policy "users can view their own attendance" on attendance for select using (auth.uid() = user_id);
-- The proximity + "has the event actually started" checks that make a
-- confirmation meaningful happen in the app layer (src/app/events/actions.ts,
-- against the shared check in src/lib/location.ts) before this insert is
-- attempted — this policy is the RLS backstop that a user can only ever
-- confirm attendance as themselves, not the source of truth for whether
-- the confirmation is legitimate.
create policy "users can confirm their own attendance" on attendance for insert with check (auth.uid() = user_id);

-- No public select policy: same owner-only posture as `users` (see
-- db/migrations/0005_profile_fields.sql) — a future public-profile/feed
-- feature should read this through its own narrow security-definer
-- accessor rather than loosening these policies.
create policy "users can view own profile fields" on user_profiles for select using (auth.uid() = user_id);
create policy "users can insert own profile fields" on user_profiles for insert with check (auth.uid() = user_id);
create policy "users can update own profile fields" on user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── RSVP counts (privacy-preserving) ─────────────────────────
-- The rsvps select policy above is intentionally scoped to auth.uid() =
-- user_id, so a plain client-side select can't read other users' RSVPs
-- to compute "N going". This returns aggregate going counts only — never
-- which specific users are going, and never save counts (saves are a
-- private bookmark, not a public signal) — via a security-definer function.
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

-- Toggling going/saved independently requires a read-modify-write to avoid
-- clobbering the untouched column. Doing that read in the app layer is
-- racy under concurrent toggles (two calls can read the same stale row and
-- each write back a state that drops the other's change), so it's done
-- here instead: each function runs as a single statement/transaction, and
-- the delete-then-update ordering means a row is only ever left in a state
-- that satisfies check(going or saved), never briefly violates it.
create or replace function public.set_rsvp_going(p_event_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_value then
    insert into rsvps (user_id, event_id, going, saved)
    values (auth.uid(), p_event_id, true, false)
    on conflict (user_id, event_id) do update set going = true;
  else
    delete from rsvps
    where user_id = auth.uid() and event_id = p_event_id and not saved;

    update rsvps set going = false
    where user_id = auth.uid() and event_id = p_event_id;
  end if;
end;
$$;

grant execute on function public.set_rsvp_going(uuid, boolean) to authenticated;

create or replace function public.set_rsvp_saved(p_event_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_value then
    insert into rsvps (user_id, event_id, going, saved)
    values (auth.uid(), p_event_id, false, true)
    on conflict (user_id, event_id) do update set saved = true;
  else
    delete from rsvps
    where user_id = auth.uid() and event_id = p_event_id and not going;

    update rsvps set saved = false
    where user_id = auth.uid() and event_id = p_event_id;
  end if;
end;
$$;

grant execute on function public.set_rsvp_saved(uuid, boolean) to authenticated;

-- ── Invite gating ─────────────────────────────────────────────
-- Registration happens before the requester has a session, so these run
-- security definer rather than depending on RLS policies scoped to
-- auth.uid(). Each is deliberately narrow (an existence check, an atomic
-- redeem, a rollback, an own-tree read) rather than exposing the invites
-- table broadly to anon/authenticated.

-- Peek only, no side effects — used to show a clear error before
-- rendering the registration form, without consuming the invite. The real
-- check that matters is the atomic one in redeem_invite at submit time.
-- Returns one of: 'unused' (redeemable), 'used', 'expired', 'revoked',
-- 'not_found'. A token that's actually past its expires_at but still
-- stored as 'unused' is reported 'expired' here without writing anything —
-- the lazy flip happens in redeem_invite, the one place a real attempt to
-- use it happens.
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

-- Peek-only: returns the inviter's generation-time coordinates for a still-
-- redeemable invite, so a scan-time GPS check can be run before actually
-- consuming the token. Null lat/lng (not an error) means the inviter's
-- device didn't have a location when they generated it — callers treat
-- that as "no proximity check possible for this invite", not a failure.
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

-- Atomically marks an invite used. The single UPDATE ... WHERE status =
-- 'unused' is what makes this race-safe: if two people redeem the same
-- token at once, only one UPDATE matches a row and returns it. Also
-- refuses (and lazily flips to 'expired') a token whose expires_at has
-- passed. Returns the stored lat/lng too, so the caller's GPS check is
-- redone against this atomic read rather than trusted from an earlier peek.
--
-- reusable=true (venue check-in codes, docs/designdoc.md §3.1/§4.16) is a
-- real behavioral fork here, not an additive change: a printed poster is
-- scanned by many different people over one show, so it must never flip
-- to 'used' — the status-flipping UPDATE below only ever runs for the
-- non-reusable (peer-invite) branch. The lazy expired-flip above still
-- runs unconditionally for both, so a reusable code past its
-- event-scoped expiry (src/lib/invites.ts:checkinExpiresAt) correctly
-- stops working. No rate limit/redemption cap on the reusable branch —
-- captain decision 2026-08-26, see db/migrations/0007_venue_checkin.sql.
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
-- expired" message rather than a bare not-found.
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

-- Lets the creator void a stamp before anyone's redeemed it (generated by
-- mistake, or handed out and reconsidered). Narrow on purpose: only the
-- creator, only while still 'unused' — a single UPDATE ... WHERE so a
-- concurrent redeem and revoke can't both "win", same pattern as above.
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

-- Rolls back a redeem when the account creation that followed it failed,
-- so a real signup error doesn't permanently burn a valid invite.
create or replace function public.release_invite(target_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update invites
  set status = 'unused', used_at = null
  where id = target_invite_id and status = 'used';
$$;

grant execute on function public.release_invite(uuid) to anon;

-- Profile's invite tree: every invite the caller has generated, and who
-- (if anyone) redeemed it. security definer so this can join into other
-- users' name/created_at without a broader users select policy.
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

-- Profile's "invited by" card: the single person whose invite let the
-- caller in, if any. users.invited_by points at the invites row, not the
-- inviter directly, so this walks invited_by -> invites.created_by ->
-- users. Returns zero rows for a user with no inviter (invited_by is
-- null, e.g. a seed/first account created outside the invite flow) —
-- callers should treat an empty result as "no inviter", not an error.
-- security definer for the same reason as get_invite_tree: reads another
-- user's name past the own-row users select policy.
create or replace function public.get_my_inviter()
returns table (
  inviter_id uuid,
  inviter_name text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select inviter.id, inviter.name, me.created_at
  from users me
  join invites i on i.id = me.invited_by
  join users inviter on inviter.id = i.created_by
  where me.id = auth.uid();
$$;

grant execute on function public.get_my_inviter() to authenticated;

-- ── Venue claims (admin review) ───────────────────────────────
-- Admin-only reads/mutations go through security-definer RPCs (same
-- narrow-function pattern as redeem_invite/revoke_invite) rather than an
-- admin-scoped RLS select/update policy on venue_claims — one function,
-- one state transition, internally admin-gated. is_admin is bootstrapped
-- by hand against the live project; there's no self-service "grant admin"
-- UI, deliberately.
create or replace function public.list_pending_venue_claims()
returns table (
  claim_id uuid,
  venue_id uuid,
  claimant_id uuid,
  claimant_name text,
  venue_name text,
  venue_address text,
  venue_lat double precision,
  venue_lng double precision,
  existing_venue_name text,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.venue_id, c.claimant_id, u.name, c.venue_name, c.venue_address,
    c.venue_lat, c.venue_lng, v.name, c.note, c.created_at
  from venue_claims c
  join users u on u.id = c.claimant_id
  left join venues v on v.id = c.venue_id
  where c.status = 'pending'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  order by c.created_at asc;
$$;

grant execute on function public.list_pending_venue_claims() to authenticated;

-- The trickiest new logic in this item — an atomic insert-or-update branch,
-- the closest analog to redeem_invite's "one function, one state
-- transition, admin-gated": a claim against an existing unclaimed venue
-- (venue_id set) updates that venue's owner_id; a claim for a brand-new
-- venue (venue_id null) inserts the venue first and records its id back
-- onto the claim.
create or replace function public.approve_venue_claim(claim_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  new_venue_id uuid;
begin
  if not exists (select 1 from users a where a.id = auth.uid() and a.is_admin) then
    return false;
  end if;

  select * into c from venue_claims where id = claim_id and status = 'pending';
  if not found then
    return false;
  end if;

  if c.venue_id is null then
    insert into venues (name, address, lat, lng, owner_id)
    values (c.venue_name, c.venue_address, c.venue_lat, c.venue_lng, c.claimant_id)
    returning id into new_venue_id;

    update venue_claims set venue_id = new_venue_id, status = 'approved', reviewed_at = now()
      where id = claim_id;
  else
    update venues set owner_id = c.claimant_id
      where id = c.venue_id and owner_id is null;
    if not found then
      return false;
    end if;

    update venue_claims set status = 'approved', reviewed_at = now() where id = claim_id;
  end if;

  return true;
end;
$$;

grant execute on function public.approve_venue_claim(uuid) to authenticated;

create or replace function public.reject_venue_claim(claim_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update venue_claims
  set status = 'rejected', reviewed_at = now()
  where id = claim_id
    and status = 'pending'
    and exists (select 1 from users a where a.id = auth.uid() and a.is_admin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

grant execute on function public.reject_venue_claim(uuid) to authenticated;

-- ── Profile fields (handle, avatar) ───────────────────────────
-- Narrow, single-column mutation RPCs rather than an RLS UPDATE policy on
-- `users` — see db/migrations/0005_profile_fields.sql for why (users also
-- holds phone/invited_by/created_at, which RLS can't shield column-by-column).
create or replace function public.set_handle(p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set handle = p_handle where id = auth.uid();
end;
$$;

grant execute on function public.set_handle(text) to authenticated;

create or replace function public.set_avatar_url(p_avatar_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update users set avatar_url = p_avatar_url where id = auth.uid();
$$;

grant execute on function public.set_avatar_url(text) to authenticated;

-- ── Admin review queue (Phase 4 Track A item 2) ───────────────
-- Narrow, admin-checked-internally RPCs rather than broadened RLS
-- select/update policies on events — same narrow-RPC pattern as
-- set_handle/redeem_invite/revoke_invite (see AGENTS.md). No RLS policy on
-- `events` grants admins visibility into other hosts' pending rows; these
-- functions are the only path. See db/migrations/0007_admin_review.sql.
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

-- ── Reports (Phase 4 item 6) ───────────────────────────────────
-- Same admin-only-read posture and RPC-trio shape as the venue claims /
-- event review queues above — reports has no select policy for regular
-- users, so admin access goes entirely through these three functions.
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

-- ── Avatar storage ───────────────────────────────────────────
-- Public bucket (avatars are meant to be displayed everywhere a user
-- appears), one object per user at `<user_id>/avatar.<ext>` — writes
-- locked to the owning user via the folder-name-matches-auth.uid()
-- convention, same "public read, owner-only write" posture as
-- music_connections/now_playing (§6.1).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly readable" on storage.objects;
drop policy if exists "users can upload their own avatar" on storage.objects;
drop policy if exists "users can replace their own avatar" on storage.objects;
drop policy if exists "users can delete their own avatar" on storage.objects;

create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Event poster storage ─────────────────────────────────────
-- Per-event (not per-user like avatars): one object per event at
-- `<event_id>/poster.<ext>`. Public read, writes scoped through a subquery
-- against events.host_id rather than the avatar bucket's simpler
-- foldername-equals-uid check, since the folder here is an event id, not
-- the uploader's own id. See db/migrations/0008_event_posters.sql.
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

drop policy if exists "event posters are publicly readable" on storage.objects;
drop policy if exists "hosts can upload their own event poster" on storage.objects;
drop policy if exists "hosts can replace their own event poster" on storage.objects;
drop policy if exists "hosts can delete their own event poster" on storage.objects;

create policy "event posters are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-posters');

create policy "hosts can upload their own event poster"
  on storage.objects for insert
  with check (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );

create policy "hosts can replace their own event poster"
  on storage.objects for update
  using (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );

create policy "hosts can delete their own event poster"
  on storage.objects for delete
  using (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );
