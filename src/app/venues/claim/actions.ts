"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VenueClaimState = { error: string } | { success: true } | null;

const MAX_NOTE_LENGTH = 500;

// Submits a venue_claims row for admin review — deliberately no
// identity-verification here (docs/designdoc.md §3.1): manual human review
// via approve_venue_claim/reject_venue_claim (db/migrations/0006) is the
// whole point. RLS's "users can submit their own claims" policy is the real
// authorization boundary; the checks below exist to fail with a useful
// message rather than a raw constraint/insert error.
export async function submitVenueClaim(
  _prevState: VenueClaimState,
  formData: FormData
): Promise<VenueClaimState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mode = formData.get("mode") as string;
  const note =
    ((formData.get("note") as string) ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;

  if (mode === "existing") {
    const venueId = (formData.get("venueId") as string) ?? "";
    if (!venueId) {
      return { error: "Pick a venue to claim." };
    }

    const { error } = await supabase.from("venue_claims").insert({
      claimant_id: user.id,
      venue_id: venueId,
      note,
    });
    if (error) throw error;
  } else {
    const name = ((formData.get("venueName") as string) ?? "").trim();
    const address = ((formData.get("venueAddress") as string) ?? "").trim() || null;
    // formData.get() returns null for an absent field, and Number(null) is
    // 0 — which Number.isFinite happily accepts — so a missing/empty value
    // must be rejected before the numeric coercion below (same footgun
    // RegisterForm's readingFromForm already documents for lat/lng).
    const latRaw = formData.get("venueLat");
    const lngRaw = formData.get("venueLng");
    const lat = typeof latRaw === "string" && latRaw !== "" ? Number(latRaw) : NaN;
    const lng = typeof lngRaw === "string" && lngRaw !== "" ? Number(lngRaw) : NaN;

    if (!name) {
      return { error: "Venue name is required." };
    }
    // venues.lat/lng are NOT NULL, and approve_venue_claim inserts straight
    // from venue_claims.venue_lat/lng (db/migrations/0006) — a claim
    // without a location would only fail later, at approval time. Catch it
    // here instead, while it's still the claimant's problem to fix.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        error: "Venue location is required — use current location or enter it by hand.",
      };
    }

    const { error } = await supabase.from("venue_claims").insert({
      claimant_id: user.id,
      venue_name: name,
      venue_address: address,
      venue_lat: lat,
      venue_lng: lng,
      note,
    });
    if (error) throw error;
  }

  revalidatePath("/venues/claim");
  return { success: true };
}
