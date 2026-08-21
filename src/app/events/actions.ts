"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const RSVP_STATUSES = ["going", "interested", "saved"] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

function isRsvpStatus(value: FormDataEntryValue | null): value is RsvpStatus {
  return typeof value === "string" && RSVP_STATUSES.includes(value as RsvpStatus);
}

export async function setRsvp(eventId: string, status: RsvpStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isRsvpStatus(status)) return;

  await supabase
    .from("rsvps")
    .upsert(
      { user_id: user.id, event_id: eventId, status },
      { onConflict: "user_id,event_id" }
    );

  revalidatePath("/events");
}

export async function clearRsvp(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("rsvps")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  revalidatePath("/events");
}
