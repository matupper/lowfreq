-- One-off bootstrap for the captain's own account (auth.users.id =
-- '158132eb-ac14-4143-a5c8-755adb5abb4d', Google sign-in from 2026-08-10,
-- name "Matías Tupper"). This account predates lowfreq's public.users /
-- invite system entirely, so there is no existing member who could have
-- invited them and no way to create this row through the normal app flow.
--
-- The root invite created here is self-referential (the founder's own
-- invited_by ends up pointing at an invite they themselves "created") —
-- this is a deliberate one-off bootstrap for the very first user, NOT a
-- pattern to reuse or generalize for any other account.

begin;

insert into public.users (id, name, invited_by, is_founder)
values ('158132eb-ac14-4143-a5c8-755adb5abb4d', 'Matías Tupper', null, true);

with root_invite as (
  insert into public.invites (created_by, token, status, used_at)
  values (
    '158132eb-ac14-4143-a5c8-755adb5abb4d',
    'FOUNDER-ROOT-' || substr(gen_random_uuid()::text, 1, 8),
    'used',
    now()
  )
  returning id
)
update public.users
set invited_by = root_invite.id
from root_invite
where users.id = '158132eb-ac14-4143-a5c8-755adb5abb4d';

commit;
