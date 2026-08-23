-- lowfreq — full schema (v3)
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

drop table if exists attendance cascade;
drop table if exists rsvps cascade;
drop table if exists events cascade;
drop table if exists venues cascade;
drop table if exists invites cascade;
drop table if exists users cascade;

create extension if not exists pgcrypto;

-- ── Tables ───────────────────────────────────────────────────

-- users.id is the SAME id as Supabase's auth.users — no separate identity.
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'new user',
  phone text unique,
  invited_by uuid,
  created_at timestamptz not null default now()
);

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

create table events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) not null,
  host_id uuid references users(id) not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  created_at timestamptz not null default now()
);

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

create policy "users can view own row" on users for select using (auth.uid() = id);
create policy "events are publicly readable" on events for select using (true);
create policy "venues are publicly readable" on venues for select using (true);
create policy "users can create their own invites" on invites for insert with check (auth.uid() = created_by);
create policy "users can view their own invites" on invites for select using (auth.uid() = created_by);
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