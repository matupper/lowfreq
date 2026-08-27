import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveVenueClaim, rejectVenueClaim } from "./actions";

// Plain table page per docs/designdoc.md §4.12a — "doesn't need real design
// investment early." Not linked from BottomNav; reached by direct URL only
// (see src/proxy.ts's PROTECTED_PATHS for the login-redirect half of the
// gate — the is_admin check below is the other half, and the RPCs' own
// internal is_admin check is the actual security boundary).
type VenueClaimRow = {
  claim_id: string;
  venue_id: string | null;
  claimant_id: string;
  claimant_name: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  existing_venue_name: string | null;
  note: string | null;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/home");

  const { data: claims } = await supabase.rpc("list_pending_venue_claims");
  const claimRows = (claims ?? []) as VenueClaimRow[];

  return (
    <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-10 gap-10">
      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          ADMIN
        </h1>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
          pending venue claims
        </h2>
        {claimRows.length === 0 ? (
          <p className="text-sm text-kraft">Nothing pending.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border border-line rounded-[2px]">
            {claimRows.map((claim) => (
              <VenueClaimRow key={claim.claim_id} claim={claim} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function VenueClaimRow({ claim }: { claim: VenueClaimRow }) {
  const isNewVenue = claim.venue_id === null;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">
            {claim.claimant_name}{" "}
            <span className="text-kraft font-normal">
              {isNewVenue ? "wants to register" : "wants to claim"}
            </span>
          </p>
          <p className="truncate">
            {isNewVenue ? claim.venue_name : claim.existing_venue_name}
          </p>
          {isNewVenue && claim.venue_address && (
            <p className="font-mono text-[11px] text-kraft truncate">
              {claim.venue_address}
            </p>
          )}
          {isNewVenue && claim.venue_lat != null && claim.venue_lng != null && (
            <p className="font-mono text-[11px] text-kraft">
              {claim.venue_lat.toFixed(5)}, {claim.venue_lng.toFixed(5)}
            </p>
          )}
          {claim.note && (
            <p className="text-xs text-kraft italic pt-1">&ldquo;{claim.note}&rdquo;</p>
          )}
        </div>
        <span className="font-mono text-[11px] text-kraft shrink-0">
          {dateFormatter.format(new Date(claim.created_at))}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <form action={approveVenueClaim.bind(null, claim.claim_id)}>
          <button
            type="submit"
            className="font-mono text-[11px] text-riso-pink border border-riso-pink rounded-full px-3 py-1"
          >
            approve
          </button>
        </form>
        <form action={rejectVenueClaim.bind(null, claim.claim_id)}>
          <button
            type="submit"
            className="font-mono text-[11px] text-kraft border border-line rounded-full px-3 py-1"
          >
            reject
          </button>
        </form>
      </div>
    </div>
  );
}
