import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkinJoinUrl, effectiveInviteStatus } from "@/lib/invites";
import VenueCheckinQR from "@/components/VenueCheckinQR";
import GenerateCheckinButton from "@/components/GenerateCheckinButton";

type EventRow = { id: string; title: string; start_time: string };
type VenueRow = { id: string; name: string; events: EventRow[] };
type InviteRow = {
  event_id: string;
  token: string;
  status: string;
  expires_at: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// A minimal "venue's own event management view" (docs/designdoc.md §4.16) —
// nothing more than a list of the venue's own events, each with its
// check-in code. Not linked from BottomNav (mirrors /admin's direct-URL-only
// posture); reached via the "manage your venue" link on Profile.
export default async function VenueMinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [venuesResult, invitesResult] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, events(id, title, start_time)")
      .eq("owner_id", user.id)
      .order("name"),
    // Scoped by created_by via RLS ("users can view their own invites") —
    // this only ever sees check-in codes this user generated themself.
    supabase
      .from("invites")
      .select("event_id, token, status, expires_at")
      .eq("created_by", user.id)
      .eq("reusable", true),
  ]);

  const venues = (venuesResult.data ?? []) as VenueRow[];
  const invitesByEvent = new Map(
    ((invitesResult.data ?? []) as InviteRow[]).map((inv) => [inv.event_id, inv])
  );
  const origin = (await headers()).get("origin") ?? "";

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <Link href="/profile" className="font-mono text-xs text-kraft">
        &larr; profile
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOUR VENUE
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2">
          Generate a check-in code for a show and print it at the door.
          Anyone can scan it all night — no cap, no per-person limit.
        </p>
      </div>

      {venues.length === 0 ? (
        <p className="text-sm text-kraft">No claimed venues yet.</p>
      ) : (
        venues.map((venue) => {
          const events = [...venue.events].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          return (
            <section key={venue.id} className="space-y-3">
              <h2 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
                {venue.name}
              </h2>
              {events.length === 0 ? (
                <p className="text-sm text-kraft">No events at this venue yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-line border border-line rounded-[2px]">
                  {events.map((event) => {
                    const invite = invitesByEvent.get(event.id);
                    const expired =
                      !!invite &&
                      effectiveInviteStatus(invite.status, invite.expires_at) !== "unused";
                    return (
                      <div key={event.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <span className="font-mono text-[11px] text-kraft shrink-0">
                            {dateFormatter.format(new Date(event.start_time))}
                          </span>
                        </div>
                        {invite ? (
                          <VenueCheckinQR
                            joinUrl={checkinJoinUrl(origin, invite.token)}
                            token={invite.token}
                            expired={expired}
                          />
                        ) : (
                          <GenerateCheckinButton eventId={event.id} origin={origin} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
