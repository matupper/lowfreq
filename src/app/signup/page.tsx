import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";
import RegisterForm from "@/components/RegisterForm";

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

  const { data: valid } = await supabase.rpc("check_invite", {
    invite_token: token,
  });

  if (!valid) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide text-stamp-red">
          THAT STAMP&apos;S NO GOOD
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          This invite link isn&apos;t valid — it may have already been used,
          or the code&apos;s wrong. No account was created.
        </p>
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
