import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectiveInviteStatus, normalizeInviteToken, inviteJoinUrl } from "@/lib/invites";
import InviteStamp from "@/components/InviteStamp";
import { revokeInvite } from "./actions";

const STATUS_COPY: Record<string, string> = {
  used: "This stamp has already been used.",
  expired: "This stamp expired before anyone redeemed it. Generate a new one.",
  revoked: "You cancelled this stamp.",
  unused: "Show this to someone in person to let them in. Good for one use.",
};

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
    .select("id, token, status, expires_at")
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
  const status = effectiveInviteStatus(invite.status, invite.expires_at);

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
          {STATUS_COPY[status]}
        </p>
      </div>

      <InviteStamp
        joinUrl={inviteJoinUrl(origin, invite.token)}
        token={invite.token}
        status={status}
        expiresAt={invite.expires_at}
      />

      {status === "unused" && (
        <form action={revokeInvite.bind(null, invite.id)}>
          <button
            type="submit"
            className="text-kraft font-mono text-xs py-1.5 text-center w-full border border-line rounded-[2px] hover:border-kraft transition-colors"
          >
            Cancel this stamp
          </button>
        </form>
      )}
    </main>
  );
}
