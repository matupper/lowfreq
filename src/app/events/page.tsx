import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventsBrowser from "./EventsBrowser";
import { ATTENDANCE_WINDOW_HOURS, confirmAttendance, setGoing, setSaved } from "./actions";
import type { EventWithVenue } from "./types";

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

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - ATTENDANCE_WINDOW_HOURS);

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, description, start_time, venue:venues(id, name, address, lat, lng)"
    )
    .gte("start_time", windowStart.toISOString())
    .order("start_time", { ascending: true });

  const events = rawEvents ?? [];
  const eventIds = events.map((e) => e.id);

  const [countsResult, myRsvpsResult, myAttendanceResult] = await Promise.all([
    eventIds.length
      ? supabase.rpc("event_going_counts", { event_ids: eventIds })
      : Promise.resolve({ data: [] as { event_id: string; count: number }[] }),
    eventIds.length
      ? supabase.from("rsvps").select("event_id, going, saved").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string; going: boolean; saved: boolean }[] }),
    eventIds.length
      ? supabase
          .from("attendance")
          .select("event_id, confirmed_at")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string; confirmed_at: string }[] }),
  ]);

  const goingCountByEvent = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    goingCountByEvent.set(row.event_id, Number(row.count));
  }

  const myRsvpByEvent = new Map<string, { going: boolean; saved: boolean }>();
  for (const row of myRsvpsResult.data ?? []) {
    myRsvpByEvent.set(row.event_id, { going: row.going, saved: row.saved });
  }

  const myAttendanceByEvent = new Map<string, string>();
  for (const row of myAttendanceResult.data ?? []) {
    myAttendanceByEvent.set(row.event_id, row.confirmed_at);
  }

  const now = new Date();
  const eventsWithMeta: EventWithVenue[] = events
    .filter((e) => e.venue)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.start_time,
      displayTime: timeFormatter.format(new Date(e.start_time)).toLowerCase(),
      venue: Array.isArray(e.venue) ? e.venue[0] : e.venue,
      goingCount: goingCountByEvent.get(e.id) ?? 0,
      myGoing: myRsvpByEvent.get(e.id)?.going ?? false,
      mySaved: myRsvpByEvent.get(e.id)?.saved ?? false,
      hasStarted: new Date(e.start_time) <= now,
      attendedAt: myAttendanceByEvent.get(e.id) ?? null,
    }));

  return (
    <EventsBrowser
      events={eventsWithMeta}
      setGoing={setGoing}
      setSaved={setSaved}
      confirmAttendance={confirmAttendance}
    />
  );
}
