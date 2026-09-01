-- Phase 4 Track A review fix: createEvent (src/app/events/new/actions.ts)
-- inserts the events row before the poster is uploaded, since the poster
-- path is keyed by the new event's id. If the poster upload then fails
-- (storage error, or the DB update that stores poster_url), the action
-- rolls back the insert so a retry doesn't leave a duplicate pending
-- submission behind. That rollback is a plain client-side delete (the
-- server action runs under the user's own session, not a security-definer
-- RPC), so it needs an RLS policy to not silently no-op under RLS.
-- Scoped to the host's own still-pending rows only, mirroring the existing
-- "users can delete their own rsvps" policy.

begin;

create policy "hosts can delete their own pending submissions" on events
  for delete using (auth.uid() = host_id and status = 'pending');

commit;
