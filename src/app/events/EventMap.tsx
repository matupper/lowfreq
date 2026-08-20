"use client";

import type { EventWithVenue } from "./types";

type Props = {
  events: EventWithVenue[];
  focusedEventId: string | null;
  onSelect: (eventId: string) => void;
};

// Not a real map (no tile/geocoding provider is configured for this
// project) — a schematic layout of venues scaled to fit the visible
// events, close enough for "what's near what" at MVP.
export default function EventMap({ events, focusedEventId, onSelect }: Props) {
  const venues = new Map<string, EventWithVenue["venue"]>();
  const firstEventIdByVenue = new Map<string, string>();
  for (const event of events) {
    if (!venues.has(event.venue.id)) {
      venues.set(event.venue.id, event.venue);
      firstEventIdByVenue.set(event.venue.id, event.id);
    }
  }
  const eventCountByVenue = new Map<string, number>();
  for (const event of events) {
    eventCountByVenue.set(
      event.venue.id,
      (eventCountByVenue.get(event.venue.id) ?? 0) + 1
    );
  }

  const focusedVenueId = events.find((e) => e.id === focusedEventId)?.venue.id;

  const venueList = [...venues.values()];
  const lats = venueList.map((v) => v.lat);
  const lngs = venueList.map((v) => v.lng);
  const latRange = Math.max(...lats) - Math.min(...lats) || 1;
  const lngRange = Math.max(...lngs) - Math.min(...lngs) || 1;
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] text-kraft">
        approximate layout, not to scale &mdash; tap a pin
      </p>
      <div className="relative h-80 bg-surface border border-line rounded-[2px] overflow-hidden">
        {venueList.map((venue) => {
          // Invert lat so north is up; pad 12-88% so pins don't sit on
          // the edge.
          const x = 12 + ((venue.lng - minLng) / lngRange) * 76;
          const y = 12 + (1 - (venue.lat - minLat) / latRange) * 76;
          const count = eventCountByVenue.get(venue.id) ?? 0;
          const eventId = firstEventIdByVenue.get(venue.id)!;
          const isFocused = venue.id === focusedVenueId;

          return (
            <button
              key={venue.id}
              onClick={() => onSelect(eventId)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 group"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span
                className={`w-3 h-3 rounded-full bg-riso-pink group-hover:scale-125 transition-transform ${
                  isFocused ? "ring-2 ring-offset-2 ring-offset-surface ring-riso-pink scale-125" : ""
                }`}
              />
              <span className="font-mono text-[10px] text-kraft bg-surface/90 px-1.5 py-0.5 rounded-[2px] whitespace-nowrap">
                {venue.name}
                {count > 1 ? ` (${count})` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
