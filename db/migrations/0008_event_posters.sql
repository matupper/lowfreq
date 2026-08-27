-- Phase 4 Track A, item 3 (docs/designdoc.md §9): custom event poster
-- upload. Sequence-locked after 0006_event_submission.sql — there's no
-- create/edit form to attach an upload field to before that migration's
-- forms exist.
--
-- poster_url is nullable: absence keeps today's generated flyer-card
-- treatment (see EventCard.tsx). Unlike users.handle/avatar_url, this is a
-- normal owner-scoped RLS update policy rather than a narrow RPC —
-- poster_url is a plain column on `events`, which (unlike `users`) doesn't
-- hold anything that needs column-level isolation from its owner, so RLS
-- can express "the host can update their own row" directly.
--
-- The `event-posters` bucket is per-event (not per-user like `avatars`):
-- path `<event_id>/poster.<ext>`, public select, and write policies scoped
-- through a subquery against `events.host_id` rather than the avatar
-- bucket's simpler foldername-equals-uid check, since the folder here is
-- an event id, not the uploader's own id.

begin;

alter table events add column poster_url text;

create policy "hosts can edit their own unapproved events" on events
  for update using (auth.uid() = host_id and status in ('pending', 'rejected'))
  with check (auth.uid() = host_id and status in ('pending', 'rejected'));

insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

create policy "event posters are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-posters');

create policy "hosts can upload their own event poster"
  on storage.objects for insert
  with check (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );

create policy "hosts can replace their own event poster"
  on storage.objects for update
  using (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );

create policy "hosts can delete their own event poster"
  on storage.objects for delete
  using (
    bucket_id = 'event-posters'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid()
    )
  );

commit;
