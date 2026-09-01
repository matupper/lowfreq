"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEventFields, type EventFormState } from "@/app/events/eventFormState";
import { uploadEventPoster, validatePosterFile } from "@/app/events/posterUpload";

// Submissions always land 'pending' regardless of what a client sends —
// the events insert RLS policy also enforces this server-side (see
// db/migrations/0006_event_submission.sql), this is just the app-layer
// half of that same rule.
export async function createEvent(
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

  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      host_id: user.id,
      venue_id: parsed.venueId,
      title: parsed.title,
      description: parsed.description || null,
      start_time: parsed.startTime.toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { error: "Couldn't submit that event. Try again." };
  }

  if (poster.hasPoster && poster.error === null) {
    const posterError = await uploadEventPoster(supabase, inserted.id, poster.file, poster.extension);
    if (posterError) {
      // Undo the insert so a retry doesn't create a second pending
      // submission alongside this one.
      await supabase.from("events").delete().eq("id", inserted.id);
      return { error: posterError };
    }
  }

  redirect("/profile");
}
