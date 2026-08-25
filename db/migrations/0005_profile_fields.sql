-- Adds the profile-identity fields from docs/designdoc.md §4.15/§6.1's
-- "fleshed-out profiles" — avatar, handle, bio, instruments, favorites.
--
-- Data-model decision (resolves the §6.1 open question): avatar_url and
-- handle go on `users` alongside `name` — they're core identity fields the
-- same tier as name, potentially needed anywhere a user is displayed (event
-- host, invite tree, etc.). bio/instruments/favorite_* are optional,
-- list-shaped, profile-page-only content, so they live in a new
-- `user_profiles` table (1:1 with users) instead of bloating `users` with
-- nullable columns that nothing outside the profile screen reads — same
-- reasoning as keeping `attendance` separate from `rsvps` for two facts of
-- different shape/lifecycle. Instruments and each favorites category are
-- plain text[] rather than jsonb: they're flat lists of short strings, no
-- nested structure, and arrays are simpler to query/render as pills.
--
-- handle uniqueness is case-insensitive (the common handle convention —
-- "@Name" and "@name" collide) via a unique index on lower(handle), not a
-- citext column, to avoid adding an extension beyond the pgcrypto already
-- enabled. Nullable: existing users predate this feature and can't be
-- retroactively assigned one, so the column can't be NOT NULL; the edit
-- screen is what actually requires a handle before letting someone save.
--
-- avatar/handle are mutated through narrow security-definer RPCs
-- (set_avatar_url/set_handle) rather than a blanket RLS UPDATE policy on
-- `users`, because `users` also holds phone/invited_by/created_at — a
-- plain "auth.uid() = id" UPDATE policy can't restrict which *columns* a
-- client changes, only which *rows*. This mirrors the existing pattern of
-- narrow security-definer functions for every other users/invites mutation
-- (see redeem_invite, revoke_invite, set_rsvp_going).
--
-- Visibility: kept owner-only for now (same posture as the rest of `users`,
-- which is select-own-row-only because of phone). A handle only earns its
-- "public-facing identifier" purpose once something shows it to other
-- users — that's a future public-profile/feed feature, not this task, and
-- should get its own narrow security-definer accessor (like
-- get_invite_tree) rather than loosening RLS on the whole `users` row.
--
-- Avatar storage: a public `avatars` bucket, one object per user at
-- `<user_id>/avatar.<ext>` (fixed filename so re-uploads overwrite via
-- upsert instead of accumulating orphans). Public read (bucket is public +
-- explicit select policy) so avatars actually render; write/update/delete
-- restricted to the owning user via the folder-name-matches-auth.uid()
-- convention, same "never expose what shouldn't be public, lock writes to
-- the owner" posture as music_connections/now_playing (§6.1).

alter table users
  add column handle text,
  add column avatar_url text;

alter table users
  add constraint users_handle_format
    check (handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$');

create unique index users_handle_lower_idx on users (lower(handle)) where handle is not null;

create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  bio text,
  instruments text[] not null default '{}',
  favorite_artists text[] not null default '{}',
  favorite_albums text[] not null default '{}',
  favorite_songs text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

create policy "users can view own profile fields" on user_profiles
  for select using (auth.uid() = user_id);
create policy "users can insert own profile fields" on user_profiles
  for insert with check (auth.uid() = user_id);
create policy "users can update own profile fields" on user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Narrow, single-column mutation RPCs — see the header comment on why
-- these exist instead of an RLS UPDATE policy on `users`.
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

-- ── Avatar storage ───────────────────────────────────────────
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
