"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";

export type CheckInviteState = { error: string } | null;

// docs/designdoc.md §9 Phase 3 edge case: an expired code should read
// differently from "never existed" or "already used", not just a generic
// "invalid" for every case.
const STATUS_ERROR: Record<string, string> = {
  expired: "That invite has expired — ask whoever gave it to you for a new one.",
  used: "That code has already been used.",
  revoked: "That invite was cancelled by whoever generated it.",
  not_found: "That code isn't valid — check it and try again.",
};

// Manual-entry fallback on the onboarding gate. Only peeks
// (invite_lookup_status), doesn't consume the invite — redeem_invite does
// that atomically at actual registration submit, so an abandoned manual
// entry doesn't burn a stamp.
export async function checkInviteCode(
  _prevState: CheckInviteState,
  formData: FormData
): Promise<CheckInviteState> {
  const token = normalizeInviteToken((formData.get("code") as string) ?? "");

  if (!token) {
    return { error: "Enter the code from your invite stamp." };
  }

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("invite_lookup_status", {
    invite_token: token,
  });

  if (error || status !== "unused") {
    return { error: STATUS_ERROR[status ?? "not_found"] ?? STATUS_ERROR.not_found };
  }

  redirect(`/signup?token=${token}`);
}
