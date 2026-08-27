import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteToken } from "@/lib/invites";
import RegisterForm from "@/components/RegisterForm";
import CheckinConfirm from "@/components/CheckinConfirm";

// docs/designdoc.md §9 Phase 4 edge case, mirrors /signup's STATUS_COPY —
// venue codes never reach 'used' (redeem_invite's reusable branch skips
// that flip), but can still be 'expired' or 'revoked'.
const STATUS_COPY: Record<string, { heading: string; body: string }> = {
  expired: {
    heading: "THIS CODE EXPIRED",
    body: "This check-in code is no longer valid for this show.",
  },
  revoked: {
    heading: "THIS CODE'S NO GOOD",
    body: "This check-in code was cancelled.",
  },
  not_found: {
    heading: "THIS CODE'S NO GOOD",
    body: "This check-in link isn't valid.",
  },
};

// Public route — deliberately not in src/proxy.ts's PROTECTED_PATHS (a
// venue's printed QR is scanned by the phone's own camera app, with no
// session guaranteed). Not a reuse of ScanCamera.tsx/its in-app scan flow,
// which hard-codes a signup redirect regardless of session state
// (src/components/ScanCamera.tsx) — this page is the destination itself,
// and branches three ways per §3.1: invalid/expired code, no session
// (registration), session present (confirm attendance directly, skipping
// GPS entirely per AGENTS.md's attendance note).
export default async function CheckinPage({ params }: PageProps<"/checkin/[token]">) {
  const { token: rawToken } = await params;
  const token = normalizeInviteToken(rawToken);

  const supabase = await createClient();

  const { data: infoRows } = await supabase.rpc("invite_checkin_info", {
    invite_token: token,
  });
  const info = (
    infoRows as { event_id: string | null; venue_id: string | null; reusable: boolean }[] | null
  )?.[0];

  // Not a venue check-in code at all (wrong route for a peer invite, or a
  // token that doesn't exist) — fall back to the normal registration deep
  // link rather than dead-ending here. invite_lookup_status below still
  // handles "doesn't exist" for a genuine venue-code 404.
  if (!info || !info.reusable || !info.event_id) {
    redirect(`/signup?token=${token}`);
  }

  const { data: status } = await supabase.rpc("invite_lookup_status", {
    invite_token: token,
  });

  const { data: event } = await supabase
    .from("events")
    .select("title, venue:venues(name)")
    .eq("id", info.event_id)
    .maybeSingle();
  const venue = Array.isArray(event?.venue) ? event.venue[0] : event?.venue;
  const eventTitle = event?.title ?? "this show";
  const venueName = venue?.name ?? "the venue";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <RegisterForm token={token} />;
  }

  return <CheckinConfirm token={token} eventTitle={eventTitle} venueName={venueName} />;
}
