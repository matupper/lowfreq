-- lowfreq — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push` once
-- you've set up the CLI) to create the MVP tables.

create extension if not exists pgcrypto;

create table invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid, -- references users(id), added below once users exists
  token text unique not null,
  status text not null default 'unused' check (status in ('unused', 'used', 'expired')),
  expires_at timestamptz, -- null for MVP (lightweight); set for Phase 2 strict mode
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  invited_by uuid references invites(id),
  created_at timestamptz not null default now()
);

alter table invites
  add constraint invites_created_by_fkey foreign key (created_by) references users(id);

create table venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id), -- nullable: most venues start unclaimed
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

-- Helpful indexes for the MVP's core queries
create index events_start_time_idx on events (start_time);
create index rsvps_event_id_idx on rsvps (event_id);
create index invites_token_idx on invites (token);
