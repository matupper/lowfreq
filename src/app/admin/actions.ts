"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  await supabase.rpc("approve_venue_claim", { claim_id: claimId });

  revalidatePath("/admin");
}

export async function rejectVenueClaim(claimId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("reject_venue_claim", { claim_id: claimId });

  revalidatePath("/admin");
}
