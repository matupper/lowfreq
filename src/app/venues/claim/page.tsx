import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VenueClaimForm from "@/components/VenueClaimForm";

export default async function VenueClaimPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only unclaimed venues are worth offering in the picker — an
  // already-owned venue would just be refused by approve_venue_claim's
  // double-claim guard (db/migrations/0006_venue_claims.sql).
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address")
    .is("owner_id", null)
    .order("name");

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          CLAIM A VENUE
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2">
          Run a space? Claim it, or register it if it&rsquo;s not listed yet.
          An admin reviews every claim by hand before it goes live.
        </p>
      </div>

      <VenueClaimForm venues={venues ?? []} />
    </main>
  );
}
