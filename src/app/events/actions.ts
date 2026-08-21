"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const RSVP_STATUSES = ["going", "interested", "saved"] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

function isRsvpStatus(value: unknown): value is RsvpStatus {
  return typeof value === "string" && RSVP_STATUSES.includes(value as RsvpStatus);
}

function isEventId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function setRsvp(eventId: string, status: RsvpStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isEventId(eventId) || !isRsvpStatus(status)) {
    throw new Error("Invalid RSVP request");
  }

  const { error } = await supabase
    .from("rsvps")
    .upsert(
      { user_id: user.id, event_id: eventId, status },
      { onConflict: "user_id,event_id" }
    );
  if (error) throw error;

  revalidatePath("/events");
}

export async function clearRsvp(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isEventId(eventId)) {
    throw new Error("Invalid RSVP request");
  }

  const { error } = await supabase
    .from("rsvps")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);
  if (error) throw error;

  revalidatePath("/events");
}
