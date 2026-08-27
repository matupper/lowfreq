"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// approve_event/reject_event are admin-checked internally (see
// db/schema.sql) — this is a thin wrapper, not a second authorization
// layer. Redirecting non-admins here would be redundant with the page's
// own server-side is_admin check, so this just no-ops if the RPC's
// internal check fails.
export async function approveEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("approve_event", {
    target_event_id: eventId,
  });
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/home");
}

export async function rejectEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("reject_event", {
    target_event_id: eventId,
  });
  if (error) throw error;

  revalidatePath("/admin");
}
