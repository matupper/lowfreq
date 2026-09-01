"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken, checkinExpiresAt } from "@/lib/invites";

// Finds this event's existing reusable check-in code, or creates one.
// invites_event_reusable_idx (db/migrations/0007_venue_checkin.sql) is the
// real guard against two live codes for the same event — the select-first
// here just avoids hitting that constraint on every normal (non-racing)
// call.
export async function getOrCreateCheckinCode(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("id, start_time, venue_id, venue:venues(owner_id)")
    .eq("id", eventId)
    .maybeSingle();
  const venue = Array.isArray(event?.venue) ? event.venue[0] : event?.venue;
  if (!event || !venue || venue.owner_id !== user.id) {
    // Mirrors the RLS insert policy below — checked here too so this fails
    // with a clear error instead of a raw RLS-denied insert error.
    throw new Error("You don't own this event's venue.");
  }

  const { data: existing } = await supabase
    .from("invites")
    .select("token")
    .eq("event_id", eventId)
    .eq("reusable", true)
    .maybeSingle();
  if (existing) {
    return existing.token;
  }

  const token = generateInviteToken();
  const { data: inserted, error } = await supabase
    .from("invites")
    .insert({
      created_by: user.id,
      token,
      venue_id: event.venue_id,
      event_id: eventId,
      reusable: true,
      expires_at: checkinExpiresAt(new Date(event.start_time)),
    })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Lost a double-click race against invites_event_reusable_idx —
      // someone else's insert won, so use the code that actually landed
      // rather than erroring out.
      const { data: winner } = await supabase
        .from("invites")
        .select("token")
        .eq("event_id", eventId)
        .eq("reusable", true)
        .maybeSingle();
      if (winner) {
        revalidatePath("/venues/mine");
        return winner.token;
      }
    }
    throw error;
  }

  revalidatePath("/venues/mine");
  return inserted.token;
}
