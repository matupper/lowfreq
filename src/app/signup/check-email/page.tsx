import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Dedicated landing spot for "signup succeeded, but this Supabase project
// requires email confirmation before a session exists" — a distinct,
// expected outcome, not an error. registerWithInvite (src/app/signup/actions.ts)
// redirects here instead of returning inline state so this isn't gated on
// /signup?token=…'s own invite-status check, which would otherwise now see
// the (correctly) freshly-used invite and render its "already used"
// dead-end in place of whatever this page would have shown. See that
// action's comment for the full mechanism.
export default async function CheckEmailPage({
  searchParams,
}: PageProps<"/signup/check-email">) {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getClaims();

  if (session?.claims) {
    redirect("/home");
  }

  const params = await searchParams;
  const email = typeof params?.email === "string" ? params.email : null;

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
      <h1 className="font-display text-3xl leading-none tracking-wide">
        CHECK YOUR EMAIL
      </h1>
      <p className="text-sm text-kraft leading-relaxed max-w-xs">
        Your account is created.{" "}
        {email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="text-ink">{email}</span>.
          </>
        ) : (
          "We sent you a confirmation link."
        )}{" "}
        Open it, then log in.
      </p>
      <Link
        href="/login"
        className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
      >
        Back to log in
      </Link>
    </main>
  );
}
