"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";
import { confirmAttendance, type ConfirmAttendanceResult } from "@/app/events/actions";

export type CheckinConfirmResult = ConfirmAttendanceResult | { ok: false; reason: "invalid" };

// The session-present branch of /checkin/[token] (docs/designdoc.md §3.1's
// third case: "app installed, logged in" -> confirm attendance directly).
// Routes through redeem_invite first — same as the no-session/registration
// branch (RegisterForm -> registerWithInvite) — so an expired/revoked code
// is refused here exactly the same way it would be for a fresh signup,
// rather than this branch trusting the token's mere presence. Redeeming a
// reusable invite never marks it 'used' (db/schema.sql's redeem_invite), so
// this doesn't consume anything a later scanner would need.
export async function confirmCheckinAttendance(token: string): Promise<CheckinConfirmResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalized = normalizeInviteToken(token);

  const { data: redeemedRows } = await supabase.rpc("redeem_invite", {
    invite_token: normalized,
  });
  const redeemed = (redeemedRows as { invite_id: string }[] | null)?.[0];
  if (!redeemed?.invite_id) {
    return { ok: false, reason: "invalid" };
  }

  const { data: infoRows } = await supabase.rpc("invite_checkin_info", {
    invite_token: normalized,
  });
  const info = (
    infoRows as { event_id: string | null; venue_id: string | null; reusable: boolean }[] | null
  )?.[0];
  if (!info?.reusable || !info.event_id) {
    return { ok: false, reason: "invalid" };
  }

  return confirmAttendance(info.event_id, null, "venue_qr");
}
