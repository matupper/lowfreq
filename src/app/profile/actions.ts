"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken, inviteExpiresAt } from "@/lib/invites";

const MAX_ATTEMPTS = 3;

// Generates a single-use invite and hands the visitor straight to its
// display screen. Retries on the (astronomically unlikely) token collision
// rather than surfacing that as a user-facing error.
//
// `location` is the generator's device position, captured client-side
// right before this is called (see GenerateInviteButton) — best-effort:
// null if geolocation was denied/unavailable. A missing location doesn't
// block generation, it just means the scan-time GPS check in
// src/app/signup/actions.ts can't run for this particular invite (see
// docs/designdoc.md §9 Phase 3 and invite_location's comment in schema.sql).
export async function createInvite(location: { lat: number; lng: number } | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const token = generateInviteToken();
    const { error } = await supabase.from("invites").insert({
      created_by: user.id,
      token,
      expires_at: inviteExpiresAt(),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    });

    if (!error) {
      redirect(`/profile/invite?token=${token}`);
    }
    if (error.code !== "23505") {
      // Not a unique-token collision — a retry won't help.
      throw error;
    }
  }

  throw new Error("Couldn't generate a unique invite code — try again.");
}
