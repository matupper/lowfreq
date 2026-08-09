-- lowfreq — full schema (v2)
-- Safe to re-run: drops existing tables/trigger first, then recreates everything.
-- Run this in the Supabase SQL editor.

-- ── Clean slate ──────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

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
  status text not null default 'unused' check (status in ('unused', 'used', 'expired')),
  expires_at timestamptz,
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

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  event_id uuid references events(id) not null,
  status text not null default 'going' check (status in ('going', 'interested', 'saved')),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- ── Indexes ──────────────────────────────────────────────────
create index events_start_time_idx on events (start_time);
create index rsvps_event_id_idx on rsvps (event_id);
create index invites_token_idx on invites (token);

-- ── Auto-create a users row when someone signs up via Supabase Auth ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'new user'));
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

create policy "users can view own row" on users for select using (auth.uid() = id);
create policy "events are publicly readable" on events for select using (true);
create policy "venues are publicly readable" on venues for select using (true);
create policy "users can view their own rsvps" on rsvps for select using (auth.uid() = user_id);
create policy "users can create their own rsvps" on rsvps for insert with check (auth.uid() = user_id);