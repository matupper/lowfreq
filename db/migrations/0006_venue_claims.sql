-- Phase 4 (docs/designdoc.md §9): admin concept + venue claiming/registration.
--
-- `is_admin` is greenfield here rather than added by a separate Track A
-- migration — see CLAUDE.md/AGENTS.md for why Track B owns bootstrapping it
-- if Track A's admin-queue migration hasn't landed yet by the time this
-- runs. Bootstrapped by hand against the live project
-- (`update users set is_admin = true where id = '<uuid>'`) — no self-service
-- "grant admin" UI, deliberately.
--
-- `venue_claims` is a separate table, not a status column bolted onto
-- `venues` directly: `venues.owner_id` must only ever be set via admin
-- approval, and a naive owner-scoped update policy letting a user set
-- `owner_id = auth.uid()` on `venues` directly is exactly the
-- "self-approval" bug shape AGENTS.md's RPC-not-RLS-update note warns
-- about. This table covers both "claim an existing unclaimed venue"
-- (venue_id set) and "register a brand-new one" (venue_id null, the
-- name/address/lat/lng fields filled instead).
begin;

alter table users add column if not exists is_admin boolean not null default false;

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

alter table venue_claims enable row level security;

create policy "users can submit their own claims" on venue_claims
  for insert with check (auth.uid() = claimant_id);
create policy "users can view their own claims" on venue_claims
  for select using (auth.uid() = claimant_id);

-- Admin-only reads/mutations go through security-definer RPCs (same
-- narrow-function pattern as redeem_invite/revoke_invite) rather than an
-- admin-scoped RLS select/update policy on venue_claims — one function,
-- one state transition, internally admin-gated.
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
      -- Someone else claimed this venue first — refuse the double-claim
      -- rather than silently overwriting the existing owner.
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

commit;
