import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken, inviteJoinUrl } from "@/lib/invites";
import InviteStamp from "@/components/InviteStamp";

export default async function InviteDisplayPage({
  searchParams,
}: PageProps<"/profile/invite">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const rawToken = typeof params?.token === "string" ? params.token : "";
  const token = normalizeInviteToken(rawToken);

  if (!token) {
    redirect("/profile");
  }

  // Scoped by created_by via RLS — this can only ever load an invite this
  // user generated themself.
  const { data: invite } = await supabase
    .from("invites")
    .select("token, status")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide">
          NO INVITE SELECTED
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          Generate one from your profile.
        </p>
        <Link
          href="/profile"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Back to profile
        </Link>
      </main>
    );
  }

  const origin = (await headers()).get("origin") ?? "";

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOUR STAMP
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2 max-w-xs">
          {invite.status === "used"
            ? "This stamp has already been used."
            : "Show this to someone in person to let them in. Good for one use."}
        </p>
      </div>

      <InviteStamp
        joinUrl={inviteJoinUrl(origin, invite.token)}
        token={invite.token}
        used={invite.status === "used"}
      />
    </main>
  );
}
