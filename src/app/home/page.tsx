import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeBrowser from "./HomeBrowser";
import { confirmAttendance, setGoing, setSaved } from "@/app/events/actions";
import { ATTENDANCE_WINDOW_HOURS } from "@/app/events/constants";
import { dateKeyInZone } from "@/lib/dateGrouping";
import type { EventWithVenue } from "@/app/events/types";

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

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  // Set by BottomNav's "map" tab when it's reached from a route other than
  // /home itself (e.g. /profile) — see BottomNav.tsx's fallback-to-href
  // comment. On /home, switching tabs is in-page view state instead.
  const initialView = params?.view === "map" ? "map" : "list";

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - ATTENDANCE_WINDOW_HOURS);

  // RLS's "approved events are publicly readable" policy also lets a host
  // select their own pending/rejected submissions (`or host_id =
  // auth.uid()`), so this explicit filter is load-bearing, not redundant —
  // without it a host would see their own unapproved submission mixed into
  // their normal feed. See db/migrations/0006_event_submission.sql.
  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, description, start_time, poster_url, venue:venues(id, name, address, lat, lng)"
    )
    .eq("status", "approved")
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
  const todayKey = dateKeyInZone(now, SCENE_TIMEZONE);
  const eventsWithMeta: EventWithVenue[] = events
    .filter((e) => e.venue)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.start_time,
      displayTime: timeFormatter.format(new Date(e.start_time)).toLowerCase(),
      dateKey: dateKeyInZone(new Date(e.start_time), SCENE_TIMEZONE),
      venue: Array.isArray(e.venue) ? e.venue[0] : e.venue,
      goingCount: goingCountByEvent.get(e.id) ?? 0,
      myGoing: myRsvpByEvent.get(e.id)?.going ?? false,
      mySaved: myRsvpByEvent.get(e.id)?.saved ?? false,
      hasStarted: new Date(e.start_time) <= now,
      attendedAt: myAttendanceByEvent.get(e.id) ?? null,
      posterUrl: e.poster_url,
    }));

  return (
    <HomeBrowser
      events={eventsWithMeta}
      todayKey={todayKey}
      initialView={initialView}
      setGoing={setGoing}
      setSaved={setSaved}
      confirmAttendance={confirmAttendance}
    />
  );
}
