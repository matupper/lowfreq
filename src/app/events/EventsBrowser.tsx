"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import EventMap from "./EventMap";
import type { EventWithVenue } from "./types";

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
  setGoing: (eventId: string, going: boolean) => Promise<void>;
  setSaved: (eventId: string, saved: boolean) => Promise<void>;
};

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

export default function EventsBrowser({ events, setGoing, setSaved }: Props) {
  const [view, setView] = useState<"list" | "map">("list");
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimisticEvents, applyOptimisticRsvp] = useOptimistic(
    events,
    applyRsvp
  );

  useEffect(() => {
    if (view !== "list" || !focusedEventId) return;
    document
      .getElementById(`event-${focusedEventId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [view, focusedEventId]);

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

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8">
      <div className="flex justify-between items-center">
        <Link href="/home" className="font-mono text-xs text-kraft">
          &larr; home
        </Link>
        <div className="flex border border-line rounded-full p-1 gap-1">
          <button
            onClick={() => setView("list")}
            className={`font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
              view === "list" ? "bg-ink text-btn-on-ink" : "text-kraft"
            }`}
          >
            list
          </button>
          <button
            onClick={() => setView("map")}
            className={`font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
              view === "map" ? "bg-ink text-btn-on-ink" : "text-kraft"
            }`}
          >
            map
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          SHOWS
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2">
          Upcoming, soonest first.
        </p>
        {rsvpError && (
          <p className="font-mono text-[11px] text-stamp-red pt-1">
            {rsvpError}
          </p>
        )}
      </div>

      {optimisticEvents.length === 0 ? (
        <p className="font-mono text-xs text-kraft">
          nothing on the calendar yet — check back soon.
        </p>
      ) : view === "map" ? (
        <EventMap
          events={optimisticEvents}
          focusedEventId={focusedEventId}
          onSelect={(id) => {
            setFocusedEventId(id);
            setView("list");
          }}
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {optimisticEvents.map((event, i) => (
            <li key={event.id} id={`event-${event.id}`}>
              <EventCard
                event={event}
                rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]}
                focused={event.id === focusedEventId}
                setGoing={handleSetGoing}
                setSaved={handleSetSaved}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EventCard({
  event,
  rotation,
  focused,
  setGoing,
  setSaved,
}: {
  event: EventWithVenue;
  rotation: string;
  focused: boolean;
  setGoing: (eventId: string, going: boolean) => void;
  setSaved: (eventId: string, saved: boolean) => void;
}) {
  return (
    <div
      className={`bg-surface border border-ink rounded-[2px] p-5 ${rotation} ${
        focused ? "ring-2 ring-riso-pink" : ""
      }`}
    >
      <h2 className="font-display text-2xl leading-tight tracking-wide">
        {event.title}
      </h2>
      <p className="font-mono text-[11px] text-kraft mt-2">
        {event.venue.name} &middot; {event.displayTime}
        {event.goingCount > 0 && (
          <>
            {" "}
            &middot; {event.goingCount} going
          </>
        )}
      </p>

      {event.description && (
        <p className="text-sm text-ink/90 leading-relaxed mt-3">
          {event.description}
        </p>
      )}

      <div className="border-t border-dashed border-line mt-4 pt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setGoing(event.id, !event.myGoing)}
          className={`font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border transition-colors ${
            event.myGoing
              ? "border-riso-pink text-riso-pink"
              : "border-line text-kraft hover:border-kraft"
          }`}
        >
          going
        </button>
        <button
          type="button"
          onClick={() => setSaved(event.id, !event.mySaved)}
          className={`font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border transition-colors ${
            event.mySaved
              ? "border-riso-pink text-riso-pink"
              : "border-line text-kraft hover:border-kraft"
          }`}
        >
          save
        </button>
      </div>
    </div>
  );
}
