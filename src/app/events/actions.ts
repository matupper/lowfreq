"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isEventId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Going and saved are independent booleans on the same row (see
// docs/designdoc.md §6) — toggling one must not clobber the other, so this
// reads the row's current opposite value before writing, and deletes the
// row entirely once both are false rather than leaving an inert 0/0 record.
async function updateRsvp(
  eventId: string,
  patch: { going: boolean } | { saved: boolean }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isEventId(eventId)) {
    throw new Error("Invalid RSVP request");
  }

  const { data: existing, error: readError } = await supabase
    .from("rsvps")
    .select("going, saved")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();
  if (readError) throw readError;

  const next = {
    going: "going" in patch ? patch.going : (existing?.going ?? false),
    saved: "saved" in patch ? patch.saved : (existing?.saved ?? false),
  };

  if (!next.going && !next.saved) {
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("rsvps")
      .upsert(
        { user_id: user.id, event_id: eventId, ...next },
        { onConflict: "user_id,event_id" }
      );
    if (error) throw error;
  }

  revalidatePath("/events");
}

export async function setGoing(eventId: string, going: boolean) {
  await updateRsvp(eventId, { going });
}

export async function setSaved(eventId: string, saved: boolean) {
  await updateRsvp(eventId, { saved });
}
