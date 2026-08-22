"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken } from "@/lib/invites";

const MAX_ATTEMPTS = 3;

// Generates a single-use invite and hands the visitor straight to its
// display screen. Retries on the (astronomically unlikely) token collision
// rather than surfacing that as a user-facing error.
export async function createInvite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const token = generateInviteToken();
    const { error } = await supabase
      .from("invites")
      .insert({ created_by: user.id, token });

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
