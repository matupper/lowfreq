"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";

export type RegisterState =
  | { error: string }
  | { message: string }
  | { invalidInvite: true }
  | null;

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

  // Atomic — redeems the invite before creating the account, so two people
  // racing on the same token can't both get in. This is the check that
  // actually matters (see check_invite's comment for why the page-load
  // check alone isn't enough).
  const { data: redeemedRows, error: redeemError } = await supabase.rpc(
    "redeem_invite",
    { invite_token: token }
  );
  const redeemed = (redeemedRows as { invite_id: string }[] | null)?.[0];

  if (redeemError || !redeemed?.invite_id) {
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
