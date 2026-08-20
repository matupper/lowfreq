"use client";

import { useEffect, useState } from "react";
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

const STATUS_LABELS = {
  going: "going",
  interested: "interested",
  saved: "saved",
} as const;

type Props = {
  events: EventWithVenue[];
  setRsvp: (formData: FormData) => void;
  clearRsvp: (formData: FormData) => void;
};

export default function EventsBrowser({ events, setRsvp, clearRsvp }: Props) {
  const [view, setView] = useState<"list" | "map">("list");
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "list" || !focusedEventId) return;
    document
      .getElementById(`event-${focusedEventId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [view, focusedEventId]);

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
      </div>

      {events.length === 0 ? (
        <p className="font-mono text-xs text-kraft">
          nothing on the calendar yet — check back soon.
        </p>
      ) : view === "map" ? (
        <EventMap
          events={events}
          focusedEventId={focusedEventId}
          onSelect={(id) => {
            setFocusedEventId(id);
            setView("list");
          }}
        />
      ) : (
        <ul className="flex flex-col gap-6">
          {events.map((event, i) => (
            <li key={event.id} id={`event-${event.id}`}>
              <EventCard
                event={event}
                rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]}
                focused={event.id === focusedEventId}
                setRsvp={setRsvp}
                clearRsvp={clearRsvp}
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
  setRsvp,
  clearRsvp,
}: {
  event: EventWithVenue;
  rotation: string;
  focused: boolean;
  setRsvp: (formData: FormData) => void;
  clearRsvp: (formData: FormData) => void;
}) {
  const total = event.counts.going + event.counts.interested + event.counts.saved;

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
        {total > 0 && (
          <>
            {" "}
            &middot; {event.counts.going} going
          </>
        )}
      </p>

      {event.description && (
        <p className="text-sm text-ink/90 leading-relaxed mt-3">
          {event.description}
        </p>
      )}

      <div className="border-t border-dashed border-line mt-4 pt-4 flex flex-wrap items-center gap-2">
        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map(
          (status) => {
            const active = event.myStatus === status;
            return (
              <form key={status} action={setRsvp}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className={`font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border transition-colors ${
                    active
                      ? "border-riso-pink text-riso-pink"
                      : "border-line text-kraft hover:border-kraft"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              </form>
            );
          }
        )}

        {event.myStatus && (
          <form action={clearRsvp}>
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-wide text-kraft px-2 py-1.5"
            >
              clear
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
