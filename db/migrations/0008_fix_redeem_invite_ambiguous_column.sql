-- Restates, as its own migration step, the redeem_invite fix that was applied
-- live against lowfreq-dev as `fix_redeem_invite_reusable_ambiguous_column`
-- (version 20260827171936) but folded back in-place into 0007_venue_checkin.sql
-- instead of being committed as a separate file. Pure audit-trail
-- restatement — no behavior change, since 0007's committed definition
-- already matches what's live. See AGENTS.md's migration-drift note.
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
