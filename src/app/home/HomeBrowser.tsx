"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import EventCard from "@/app/events/EventCard";
import type { EventWithVenue } from "@/app/events/types";
import { getCurrentLocation } from "@/lib/geolocation-client";
import type { GeoReading } from "@/lib/location";
import type { ConfirmAttendanceResult } from "@/app/events/actions";
import { formatDateGroupHeader } from "@/lib/dateGrouping";
import BottomNav from "@/components/BottomNav";

// maplibre-gl reaches for `window`/canvas at module load — keep it out of
// the server bundle and only pull it in once someone actually opens the
// map tab, not on every list-view page load.
const EventMap = dynamic(() => import("@/app/events/EventMap"), {
  ssr: false,
  loading: () => (
    <p className="font-mono text-xs text-kraft py-10 text-center">
      loading map…
    </p>
  ),
});

// -1deg to 1deg max per the style guide's motif rules — cycle through a
// small fixed set rather than randomizing on every render.
const CARD_ROTATIONS = [
  "rotate-[-0.6deg]",
  "rotate-[0.5deg]",
  "rotate-[-0.3deg]",
  "rotate-[0.7deg]",
];

type RsvpAction =
  | { eventId: string; kind: "going"; value: boolean }
  | { eventId: string; kind: "saved"; value: boolean };

type Props = {
  events: EventWithVenue[];
  // "YYYY-MM-DD" for today in the scene's display time zone — the shows
  // list groups by this same key (event.dateKey), and the group matching
  // it is headed "TONIGHT" instead of a weekday/date (see CLAUDE.md's
  // "Landing page" section).
  todayKey: string;
  // Set by BottomNav's "map" tab when it navigated here from a different
  // route (e.g. /profile) via ?view=map — see home/page.tsx.
  initialView: "list" | "map";
  setGoing: (eventId: string, going: boolean) => Promise<void>;
  setSaved: (eventId: string, saved: boolean) => Promise<void>;
  confirmAttendance: (
    eventId: string,
    reading: GeoReading | null
  ) => Promise<ConfirmAttendanceResult>;
};

type EventGroup = { dateKey: string; label: string; events: EventWithVenue[] };

// Events arrive sorted by start_time ascending (see home/page.tsx's query),
// so same-day events are already contiguous — bucketing just has to notice
// when dateKey changes, not sort or re-group anything.
function groupByDate(events: EventWithVenue[], todayKey: string): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const current = groups[groups.length - 1];
    if (current && current.dateKey === event.dateKey) {
      current.events.push(event);
    } else {
      groups.push({
        dateKey: event.dateKey,
        label: event.dateKey === todayKey ? "TONIGHT" : formatDateGroupHeader(event.dateKey),
        events: [event],
      });
    }
  }
  return groups;
}

function applyRsvp(events: EventWithVenue[], action: RsvpAction) {
  return events.map((event) => {
    if (event.id !== action.eventId) return event;
    if (action.kind === "going") {
      if (event.myGoing === action.value) return event;
      const goingCount = event.goingCount + (action.value ? 1 : -1);
      return { ...event, myGoing: action.value, goingCount };
    }
    if (event.mySaved === action.value) return event;
    return { ...event, mySaved: action.value };
  });
}

export default function HomeBrowser({
  events,
  todayKey,
  initialView,
  setGoing,
  setSaved,
  confirmAttendance,
}: Props) {
  const [view, setView] = useState<"list" | "map">(initialView);
  // Lazily mount the map the first time it's opened, then leave it mounted
  // (just hidden) so switching tabs doesn't tear down and rebuild the
  // maplibre instance/camera position every time.
  const [mapMounted, setMapMounted] = useState(false);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  // Bumped on every "view on map" click so re-targeting the same event
  // (e.g. after closing its card and reopening it from the list) still
  // re-triggers the map's fly-to/open-card effect, which otherwise
  // wouldn't fire again for an unchanged focusedEventId.
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimisticEvents, applyOptimisticRsvp] = useOptimistic(
    events,
    applyRsvp
  );

  const [attendanceStatus, setAttendanceStatus] = useState<
    Record<string, "pending" | "confirmed" | ConfirmAttendanceResult>
  >({});

  useEffect(() => {
    // Same justified state-in-effect pattern as ThemeToggle: mirroring an
    // external switch (the view tab) into "has the map ever been opened".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === "map") setMapMounted(true);
  }, [view]);

  useEffect(() => {
    if (view !== "list" || !focusedEventId) return;
    document
      .getElementById(`event-${focusedEventId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [view, focusedEventId]);

  function handleViewOnMap(eventId: string) {
    setFocusedEventId(eventId);
    setMapFocusNonce((n) => n + 1);
    setView("map");
  }

  function handleViewInList(eventId: string) {
    setFocusedEventId(eventId);
    setView("list");
  }

  function handleSetGoing(eventId: string, going: boolean) {
    startTransition(async () => {
      applyOptimisticRsvp({ eventId, kind: "going", value: going });
      try {
        await setGoing(eventId, going);
        setRsvpError(null);
      } catch {
        setRsvpError("couldn't save that rsvp — try again.");
      }
    });
  }

  function handleSetSaved(eventId: string, saved: boolean) {
    startTransition(async () => {
      applyOptimisticRsvp({ eventId, kind: "saved", value: saved });
      try {
        await setSaved(eventId, saved);
        setRsvpError(null);
      } catch {
        setRsvpError("couldn't save that — try again.");
      }
    });
  }

  function handleConfirmAttendance(eventId: string) {
    setAttendanceStatus((prev) => ({ ...prev, [eventId]: "pending" }));
    startTransition(async () => {
      const location = await getCurrentLocation();
      const reading = location.status === "ok" ? location.reading : null;
      const result = await confirmAttendance(eventId, reading);
      setAttendanceStatus((prev) => ({
        ...prev,
        [eventId]: result.ok ? "confirmed" : result,
      }));
    });
  }

  const groups = groupByDate(optimisticEvents, todayKey);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 pt-10 pb-28 gap-8">
        <div className="space-y-1">
          <h1 className="font-display text-5xl leading-[0.88] tracking-wide">
            TONIGHT
          </h1>
          <p className="font-mono text-[11px] text-kraft uppercase tracking-wide pt-2">
            {formatDateGroupHeader(todayKey)} &middot; {events.length} shows
          </p>
          {rsvpError && (
            <p className="font-mono text-[11px] text-stamp-red pt-1">
              {rsvpError}
            </p>
          )}
        </div>

        {/* Map stays mounted (just hidden) once opened, list is
            conditionally rendered — see the mapMounted comment above. */}
        {mapMounted && (
          <div className={view === "map" ? "contents" : "hidden"}>
            <EventMap
              events={optimisticEvents}
              focusedEventId={view === "map" ? focusedEventId : null}
              focusNonce={mapFocusNonce}
              setGoing={handleSetGoing}
              setSaved={handleSetSaved}
              attendanceStatus={attendanceStatus}
              onConfirmAttendance={handleConfirmAttendance}
              onViewInList={handleViewInList}
            />
          </div>
        )}

        {view === "list" &&
          (optimisticEvents.length === 0 ? (
            <p className="font-mono text-xs text-kraft">
              nothing on the calendar yet — check back soon.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map((group) => (
                <div key={group.dateKey} className="space-y-3">
                  <p className="font-mono text-[10px] text-kraft uppercase tracking-wide">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-6">
                    {group.events.map((event, i) => (
                      <li key={event.id} id={`event-${event.id}`}>
                        <EventCard
                          event={event}
                          rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]}
                          focused={event.id === focusedEventId}
                          setGoing={handleSetGoing}
                          setSaved={handleSetSaved}
                          attendanceResult={attendanceStatus[event.id]}
                          onConfirmAttendance={handleConfirmAttendance}
                          onViewOnMap={handleViewOnMap}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
      </main>
      <BottomNav
        active={view === "map" ? "map" : "shows"}
        onSelect={(key) => setView(key === "map" ? "map" : "list")}
      />
    </div>
  );
}
