-- setGoing/setSaved previously did a read-then-write in the app layer to
-- preserve the untouched going/saved column: select the row, compute the
-- merged state in JS, then upsert or delete. Two concurrent toggles on the
-- same row (e.g. clicking "going" and "save" in quick succession) can both
-- read the same stale snapshot and each write back a state that only
-- reflects their own patch, silently dropping the other's change.
--
-- This adds security-definer RPCs that do the read-modify-write atomically
-- in a single statement/transaction per call, so concurrent calls serialize
-- on the row lock instead of racing. Adds functions only — no data changes.
begin;

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

commit;
