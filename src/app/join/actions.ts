"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";

export type CheckInviteState = { error: string } | null;

// Manual-entry fallback on the onboarding gate. Only peeks (check_invite),
// doesn't consume the invite — redeem_invite does that atomically at actual
// registration submit, so an abandoned manual entry doesn't burn a stamp.
export async function checkInviteCode(
  _prevState: CheckInviteState,
  formData: FormData
): Promise<CheckInviteState> {
  const token = normalizeInviteToken((formData.get("code") as string) ?? "");

  if (!token) {
    return { error: "Enter the code from your invite stamp." };
  }

  const supabase = await createClient();
  const { data: valid, error } = await supabase.rpc("check_invite", {
    invite_token: token,
  });

  if (error || !valid) {
    return { error: "That code isn't valid — check it and try again." };
  }

  redirect(`/signup?token=${token}`);
}
