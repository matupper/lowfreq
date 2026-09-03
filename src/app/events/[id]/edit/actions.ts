"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEventFields, type EventFormState } from "@/app/events/eventFormState";
import { uploadEventPoster, validatePosterFile } from "@/app/events/posterUpload";

// Relies on the "hosts can edit their own unapproved events" RLS policy
// (auth.uid() = host_id and status in ('pending', 'rejected')) rather than
// an app-layer ownership check — see db/migrations/0008_event_posters.sql.
// A blocked update (wrong owner, or already approved) comes back as zero
// rows updated, not an error, so that's what we check for.
export async function updateEvent(
  eventId: string,
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parseEventFields(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const poster = validatePosterFile(formData);
  if (poster.hasPoster && poster.error) {
    return { error: poster.error };
  }

  // A rejected submission goes back to 'pending' on save — editing it is
  // always a resubmission, there's no "edit but stay rejected" state. The
  // RLS with-check (tightened in db/migrations/0010) requires both
  // auth.uid() = host_id and the written status be 'pending' or 'rejected',
  // which this update satisfies since it always writes 'pending'.
  const { data: updated, error } = await supabase
    .from("events")
    .update({
      venue_id: parsed.venueId,
      title: parsed.title,
      description: parsed.description || null,
      start_time: parsed.startTime.toISOString(),
      status: "pending",
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { error: "Couldn't save that submission. Try again." };
  }

  if (poster.hasPoster && poster.error === null) {
    const posterError = await uploadEventPoster(supabase, eventId, poster.file, poster.extension);
    if (posterError) {
      return { error: posterError };
    }
  }

  redirect("/profile");
}
