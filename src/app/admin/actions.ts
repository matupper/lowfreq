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

// Both RPCs are internally admin-gated (see db/migrations/0006_venue_claims.sql)
// and re-check is_admin themselves — the redirect below is UX only, matching
// every other gated screen's belt-and-suspenders posture, not the real
// authorization boundary.
export async function approveVenueClaim(claimId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: approved } = await supabase.rpc("approve_venue_claim", {
    claim_id: claimId,
  });

  revalidatePath("/admin");
  if (!approved) redirect("/admin?error=approve_failed");
}

export async function rejectVenueClaim(claimId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rejected } = await supabase.rpc("reject_venue_claim", {
    claim_id: claimId,
  });

  revalidatePath("/admin");
  if (!rejected) redirect("/admin?error=reject_failed");
}
