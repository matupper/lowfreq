"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error: string } | { message: string } | null;

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: { name: formData.get("name") as string },
      emailRedirectTo: `${origin}/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Email confirmations off: signUp already returns a session — proceed
  // straight in. Confirmations on: no session yet, tell them to check
  // their inbox and come back to /login once confirmed.
  if (data.session) {
    redirect("/home");
  }

  return { message: "Check your email to confirm your account, then log in." };
}
