"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";
import { checkProximity, type GeoReading } from "@/lib/location";

export type RegisterState =
  | { error: string }
  | { message: string }
  | { invalidInvite: true }
  | { expired: true }
  | { locationMismatch: "too_far" | "stale" }
  | null;

// Pulls a client-submitted GPS reading out of the form, if RegisterForm
// managed to get one (see its useEffect — best-effort, never blocks
// rendering the form). Malformed/partial values are treated the same as
// "no reading" rather than as an error.
function readingFromForm(formData: FormData): GeoReading | null {
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const timestampRaw = formData.get("locationTimestamp");
  // RegisterForm submits "" (not omitting the field) when it couldn't get a
  // fix, and Number("") is 0 — which Number.isFinite happily accepts — so
  // empty strings must be rejected before the numeric coercion below.
  if (latRaw === "" || lngRaw === "" || timestampRaw === "") {
    return null;
  }
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) {
    return null;
  }
  return { lat, lng, timestamp, accuracy: 0 };
}

export async function registerWithInvite(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const token = normalizeInviteToken((formData.get("token") as string) ?? "");
  if (!token) {
    return { invalidInvite: true };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  // docs/designdoc.md §9 Phase 3: GPS proximity check "at invite scan
  // time". Architecturally, registration submit is that moment — scanning
  // just deep-links here, and the invite's short expires_at window (see
  // src/lib/invites.ts) keeps the two close together in time. Checked via
  // a peek (invite_location) before consuming the token, so a failed
  // proximity check doesn't burn a valid stamp — the user can retry.
  const invitee = readingFromForm(formData);
  const { data: locationRows } = await supabase.rpc("invite_location", {
    invite_token: token,
  });
  const inviter = (locationRows as { lat: number | null; lng: number | null }[] | null)?.[0];

  // A proximity check only runs when both sides have a reading. Missing
  // either one (inviter had no location at generation, or invitee's device
  // couldn't get one) degrades gracefully to Phase 2's guarantee
  // (single-use + expiry) rather than blocking the only path into the app —
  // see db/schema.sql's comment on invite_location for the reasoning.
  if (invitee && inviter?.lat != null && inviter?.lng != null) {
    const proximity = checkProximity(invitee, { lat: inviter.lat, lng: inviter.lng });
    if (!proximity.ok) {
      return { locationMismatch: proximity.reason };
    }
  }

  // Atomic — redeems the invite before creating the account, so two people
  // racing on the same token can't both get in. This is the check that
  // actually matters (see invite_lookup_status's comment for why the
  // page-load check alone isn't enough).
  const { data: redeemedRows, error: redeemError } = await supabase.rpc(
    "redeem_invite",
    { invite_token: token }
  );
  const redeemed = (redeemedRows as { invite_id: string }[] | null)?.[0];

  if (redeemError || !redeemed?.invite_id) {
    // Distinguish "it expired" (a specific, actionable message) from every
    // other reason a redeem can fail (raced, revoked, never existed).
    const { data: status } = await supabase.rpc("invite_lookup_status", {
      invite_token: token,
    });
    if (status === "expired") {
      return { expired: true };
    }
    return { invalidInvite: true };
  }

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        name: formData.get("username") as string,
        invite_id: redeemed.invite_id,
      },
      emailRedirectTo: `${origin}/login`,
    },
  });

  if (error) {
    // Don't let a real signup failure (bad password, email taken) burn a
    // valid invite — hand it back so the same stamp can be used again.
    await supabase.rpc("release_invite", { target_invite_id: redeemed.invite_id });
    return { error: error.message };
  }

  if (data.session) {
    redirect("/home");
  }

  return { message: "Check your email to confirm your account, then log in." };
}
