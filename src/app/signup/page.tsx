import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";
import RegisterForm from "@/components/RegisterForm";

// docs/designdoc.md §9 Phase 3 edge case: distinguish why the invite isn't
// redeemable rather than one generic "invalid" message for every case.
const STATUS_COPY: Record<string, { heading: string; body: string }> = {
  expired: {
    heading: "THAT STAMP EXPIRED",
    body: "This invite link timed out before you got here. Ask whoever gave it to you for a new one.",
  },
  used: {
    heading: "THAT STAMP'S NO GOOD",
    body: "This invite has already been used. No account was created.",
  },
  revoked: {
    heading: "THAT STAMP'S NO GOOD",
    body: "This invite was cancelled by whoever generated it. No account was created.",
  },
  not_found: {
    heading: "THAT STAMP'S NO GOOD",
    body: "This invite link isn't valid — the code's wrong. No account was created.",
  },
};

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getClaims();

  if (session?.claims) {
    redirect("/home");
  }

  const params = await searchParams;
  const rawToken = typeof params?.token === "string" ? params.token : "";
  const token = normalizeInviteToken(rawToken);

  // Registration is only reachable with an invite in hand — no token at
  // all means someone landed here directly, not through the gate/scan flow.
  if (!token) {
    redirect("/");
  }

  const { data: status } = await supabase.rpc("invite_lookup_status", {
    invite_token: token,
  });

  if (status !== "unused") {
    const copy = STATUS_COPY[status ?? "not_found"] ?? STATUS_COPY.not_found;
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide text-stamp-red">
          {copy.heading}
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">{copy.body}</p>
        <Link
          href="/"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return <RegisterForm token={token} />;
}
