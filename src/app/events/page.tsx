import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventsBrowser from "./EventsBrowser";
import { setRsvp, clearRsvp } from "./actions";
import type { EventWithVenue, RsvpStatus } from "./types";

// MVP is single-scene/single-city, so a fixed display timezone (rather
// than per-user) is the right call for now — see CLAUDE.md build order.
const SCENE_TIMEZONE = "America/Los_Angeles";
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCENE_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, description, start_time, venue:venues(id, name, address, lat, lng)"
    )
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  const events = rawEvents ?? [];
  const eventIds = events.map((e) => e.id);

  const [countsResult, myRsvpsResult] = await Promise.all([
    eventIds.length
      ? supabase.rpc("event_rsvp_counts", { event_ids: eventIds })
      : Promise.resolve({ data: [] as { event_id: string; status: string; count: number }[] }),
    eventIds.length
      ? supabase.from("rsvps").select("event_id, status").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string; status: string }[] }),
  ]);

  const countsByEvent = new Map<string, Record<RsvpStatus, number>>();
  for (const row of countsResult.data ?? []) {
    const bucket =
      countsByEvent.get(row.event_id) ??
      ({ going: 0, interested: 0, saved: 0 } as Record<RsvpStatus, number>);
    bucket[row.status as RsvpStatus] = Number(row.count);
    countsByEvent.set(row.event_id, bucket);
  }

  const myStatusByEvent = new Map<string, RsvpStatus>();
  for (const row of myRsvpsResult.data ?? []) {
    myStatusByEvent.set(row.event_id, row.status as RsvpStatus);
  }

  const eventsWithMeta: EventWithVenue[] = events
    .filter((e) => e.venue)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.start_time,
      displayTime: timeFormatter.format(new Date(e.start_time)).toLowerCase(),
      venue: Array.isArray(e.venue) ? e.venue[0] : e.venue,
      counts:
        countsByEvent.get(e.id) ??
        ({ going: 0, interested: 0, saved: 0 } as Record<RsvpStatus, number>),
      myStatus: myStatusByEvent.get(e.id) ?? null,
    }));

  return (
    <EventsBrowser
      events={eventsWithMeta}
      setRsvp={setRsvp}
      clearRsvp={clearRsvp}
    />
  );
}
