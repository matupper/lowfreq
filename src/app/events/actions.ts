"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isEventId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Going and saved are independent booleans on the same row (see
// docs/designdoc.md §6) — toggling one must not clobber the other. That
// read-modify-write happens atomically in the set_rsvp_going/set_rsvp_saved
// DB functions (db/schema.sql) rather than here, since a client-side
// read-then-write would let two concurrent toggles (e.g. "going" and
// "save" in quick succession) race on the same stale snapshot and silently
// drop one of the changes.
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

  const { error } =
    "going" in patch
      ? await supabase.rpc("set_rsvp_going", {
          p_event_id: eventId,
          p_value: patch.going,
        })
      : await supabase.rpc("set_rsvp_saved", {
          p_event_id: eventId,
          p_value: patch.saved,
        });
  if (error) throw error;

  revalidatePath("/events");
}

export async function setGoing(eventId: string, going: boolean) {
  await updateRsvp(eventId, { going });
}

export async function setSaved(eventId: string, saved: boolean) {
  await updateRsvp(eventId, { saved });
}
