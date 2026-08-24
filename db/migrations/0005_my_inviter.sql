-- Profile's "invited by" card (designdoc §4.7 rework): the single person
-- whose invite let the caller in, if any. users.invited_by points at the
-- invites row, not the inviter directly, so this walks invited_by ->
-- invites.created_by -> users. Returns zero rows for a user with no
-- inviter (invited_by is null, e.g. a seed/first account created outside
-- the invite flow) — callers should treat an empty result as "no
-- inviter", not an error.
--
-- Adds a function only — no changes to existing tables/data.
begin;

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

commit;
