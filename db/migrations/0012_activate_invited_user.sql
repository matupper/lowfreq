-- OAuth sign-in (Google/Apple via signInWithOAuth/signInWithIdToken) creates
-- a real auth.users row on first sign-in, and handle_new_user() auto-inserts
-- the matching public.users row with invited_by = null — there's no invite
-- token in the flow the way there is for auth.signUp (see handle_new_user's
-- comment in db/schema.sql: invite_id comes from signUp metadata, set by
-- redeem_invite before signUp is even called). This app is invite-only, so
-- an OAuth account still needs to attach an invite, just *after* auth
-- instead of before.
--
-- activate_invited_user calls redeem_invite internally rather than
-- duplicating its reusable-vs-single-use branch — it's already
-- security definer, so calling it from another security definer function
-- runs with the same (definer's) privileges, no separate grant needed for
-- this function to reach the invites table itself.
--
-- Guards against changing an already-invited account's lineage: refuses
-- (returns no rows) if the caller's own users row already has invited_by
-- set. A real invited account (registered via the existing signUp ->
-- redeem_invite -> trigger path) should never be able to call this to
-- attach or swap an invite after the fact — only an OAuth account with
-- invited_by still null is eligible.
begin;

create or replace function public.activate_invited_user(invite_token text)
returns table (invite_id uuid, created_by uuid, lat double precision, lng double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  already_invited boolean;
  redeemed_invite_id uuid;
  redeemed_created_by uuid;
  redeemed_lat double precision;
  redeemed_lng double precision;
  updated_id uuid;
begin
  if caller_id is null then
    return;
  end if;

  select (invited_by is not null) into already_invited
  from users where id = caller_id;

  if already_invited is not false then
    -- covers both "already invited" and "no users row for this caller",
    -- neither of which should redeem an invite here.
    return;
  end if;

  select r.invite_id, r.created_by, r.lat, r.lng
    into redeemed_invite_id, redeemed_created_by, redeemed_lat, redeemed_lng
    from redeem_invite(invite_token) r;

  if redeemed_invite_id is null then
    return;
  end if;

  update users
  set invited_by = redeemed_invite_id
  where id = caller_id and invited_by is null
  returning id into updated_id;

  if updated_id is null then
    return;
  end if;

  return query select redeemed_invite_id, redeemed_created_by, redeemed_lat, redeemed_lng;
end;
$$;

grant execute on function public.activate_invited_user(text) to authenticated;

commit;
