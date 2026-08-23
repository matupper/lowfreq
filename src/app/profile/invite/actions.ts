"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Voids a stamp the caller generated, before anyone's redeemed it. The
// revoke_invite RPC is narrow on purpose (creator-only, unused-only, atomic
// UPDATE...WHERE) — see its comment in db/schema.sql — so this just calls
// it and refreshes the screens that show invite status.
export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("revoke_invite", { target_invite_id: inviteId });

  revalidatePath("/profile/invite");
  revalidatePath("/profile");
}
