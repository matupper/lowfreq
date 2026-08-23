"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkProximity, type GeoReading } from "@/lib/location";

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

export type ConfirmAttendanceResult =
  | { ok: true }
  | { ok: false; reason: "not_started" | "too_far" | "stale" | "no_location" | "error" };

// "I Was There" (docs/designdoc.md §6.1, §9 Phase 3) — deliberately
// separate from RSVP: a user can confirm attendance whether or not they
// ever RSVP'd going, and RSVPing going never implies this on its own.
//
// `reading` is null when the client couldn't get a GPS fix (denied,
// unsupported, timed out). What should happen in that case for a
// legitimately-attending user (e.g. bad signal in a basement venue) is an
// open product question — docs/designdoc.md §10 raises it and doesn't
// resolve it. This implementation takes the strict reading (no
// confirmation without a location) as a safe placeholder pending that
// decision, not as the decision itself.
export async function confirmAttendance(
  eventId: string,
  reading: GeoReading | null
): Promise<ConfirmAttendanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isEventId(eventId)) {
    throw new Error("Invalid attendance request");
  }

  const { data: event } = await supabase
    .from("events")
    .select("start_time, venue:venues(lat, lng)")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return { ok: false, reason: "error" };
  }
  if (new Date(event.start_time) > new Date()) {
    return { ok: false, reason: "not_started" };
  }

  if (!reading) {
    return { ok: false, reason: "no_location" };
  }

  const venue = Array.isArray(event.venue) ? event.venue[0] : event.venue;
  if (!venue) {
    return { ok: false, reason: "error" };
  }

  const proximity = checkProximity(reading, venue);
  if (!proximity.ok) {
    return { ok: false, reason: proximity.reason };
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(
      { user_id: user.id, event_id: eventId, method: "gps" },
      { onConflict: "user_id,event_id", ignoreDuplicates: true }
    );
  if (error) {
    return { ok: false, reason: "error" };
  }

  revalidatePath("/events");
  return { ok: true };
}
