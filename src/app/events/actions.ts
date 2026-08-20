"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const RSVP_STATUSES = ["going", "interested", "saved"] as const;
type RsvpStatus = (typeof RSVP_STATUSES)[number];

function isRsvpStatus(value: FormDataEntryValue | null): value is RsvpStatus {
  return typeof value === "string" && RSVP_STATUSES.includes(value as RsvpStatus);
}

export async function setRsvp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eventId = formData.get("eventId");
  const status = formData.get("status");
  if (typeof eventId !== "string" || !isRsvpStatus(status)) return;

  await supabase
    .from("rsvps")
    .upsert(
      { user_id: user.id, event_id: eventId, status },
      { onConflict: "user_id,event_id" }
    );

  revalidatePath("/events");
}

export async function clearRsvp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return;

  await supabase
    .from("rsvps")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  revalidatePath("/events");
}
