"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Marker,
  NavigationControl,
  Popup,
  LngLatBounds,
  MapLibreMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import EventCard from "./EventCard";
import type { EventWithVenue } from "./types";
import type { ConfirmAttendanceResult } from "./actions";

// CARTO's basemaps are free, no API key/token required — chosen
// specifically so shipping this doesn't block on a credential. Swap for
// a licensed Mapbox/MapTiler style later if the team wants official
// support behind the tiles; see docs/designdoc.md §9 Phase 1 note.
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function currentMapStyle() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? LIGHT_STYLE
    : DARK_STYLE;
}

type Props = {
  events: EventWithVenue[];
  // Set by the list view's "view on map" action — pan/zoom to this
  // event's venue and open its card as soon as the map is ready.
  focusedEventId: string | null;
  // Bumped on every "view on map" click, so re-requesting the same event
  // (e.g. after its card was closed) still re-triggers the fly-to/open.
  focusNonce: number;
  setGoing: (eventId: string, going: boolean) => void;
  setSaved: (eventId: string, saved: boolean) => void;
  attendanceStatus: Record<string, "pending" | "confirmed" | ConfirmAttendanceResult>;
  onConfirmAttendance: (eventId: string) => void;
  onViewInList: (eventId: string) => void;
};

type MarkerEntry = {
  marker: Marker;
  root: Root;
};

type PopupEntry = {
  popup: Popup;
  root: Root;
};

export default function EventMap({
  events,
  focusedEventId,
  focusNonce,
  setGoing,
  setSaved,
  attendanceStatus,
  onConfirmAttendance,
  onViewInList,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const popupRef = useRef<PopupEntry | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const { venues, eventsByVenue } = useMemo(() => {
    const venues = new Map<string, EventWithVenue["venue"]>();
    const eventsByVenue = new Map<string, EventWithVenue[]>();
    for (const event of events) {
      if (!venues.has(event.venue.id)) venues.set(event.venue.id, event.venue);
      const list = eventsByVenue.get(event.venue.id) ?? [];
      list.push(event);
      eventsByVenue.set(event.venue.id, list);
    }
    return { venues, eventsByVenue };
  }, [events]);

  // Which venues/events exist doesn't change on an RSVP toggle (that just
  // mutates fields on the same event), so key marker sync off this rather
  // than the `events` array reference to avoid rebuilding every pin on
  // every "going"/"save" click.
  const venueSignature = useMemo(
    () => events.map((e) => `${e.venue.id}:${e.id}`).join("|"),
    [events]
  );

  function handlePinClick(venueId: string) {
    const venueEvents = eventsByVenue.get(venueId) ?? [];
    if (venueEvents.length === 0) return;
    setOpenEventId((current) =>
      venueEvents.some((e) => e.id === current) ? null : venueEvents[0].id
    );
  }

  // Create/tear down the map itself only when transitioning between "no
  // venues to plot" and "some venues" — everything else (markers, popup,
  // camera moves) is handled by the effects below, not by recreating the
  // map instance.
  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;

    const initialLngLats: [number, number][] = [...venues.values()].map((v) => [
      v.lng,
      v.lat,
    ]);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: currentMapStyle(),
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      if (initialLngLats.length === 1) {
        map.jumpTo({ center: initialLngLats[0], zoom: 14 });
      } else if (initialLngLats.length > 1) {
        const bounds = initialLngLats.reduce(
          (b, ll) => b.extend(ll),
          new LngLatBounds(initialLngLats[0], initialLngLats[0])
        );
        map.fitBounds(bounds, { padding: 56, maxZoom: 15 });
      }
      setMapReady(true);
    });
    mapRef.current = map;

    const themeObserver = new MutationObserver(() => {
      map.setStyle(currentMapStyle());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const markers = markersRef.current;
    return () => {
      themeObserver.disconnect();
      for (const entry of markers.values()) entry.root.unmount();
      markers.clear();
      if (popupRef.current) popupRef.current.root.unmount();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length === 0]);

  // Sync markers: create one per venue, drop ones for venues no longer in
  // the event list, and (re)render each so the "active" pin reflects
  // whichever venue currently has its card open.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const liveVenueIds = new Set(venues.keys());
    for (const [venueId, entry] of markersRef.current) {
      if (!liveVenueIds.has(venueId)) {
        entry.marker.remove();
        entry.root.unmount();
        markersRef.current.delete(venueId);
      }
    }

    const activeVenueId = events.find((e) => e.id === openEventId)?.venue.id ?? null;

    for (const venue of venues.values()) {
      let entry = markersRef.current.get(venue.id);
      if (!entry) {
        const el = document.createElement("div");
        const root = createRoot(el);
        const marker = new Marker({ element: el, anchor: "bottom" })
          .setLngLat([venue.lng, venue.lat])
          .addTo(map);
        entry = { marker, root };
        markersRef.current.set(venue.id, entry);
      }
      const count = eventsByVenue.get(venue.id)?.length ?? 0;
      entry.root.render(
        <MapPin
          name={venue.name}
          count={count}
          active={venue.id === activeVenueId}
          onClick={() => handlePinClick(venue.id)}
        />
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueSignature, openEventId, mapReady]);

  // Fly to + open a specific event's pin when the list view asks us to
  // (the "view on map" action on an event card).
  useEffect(() => {
    if (!focusedEventId || !mapReady) return;
    const event = events.find((e) => e.id === focusedEventId);
    if (!event) return;
    mapRef.current?.flyTo({
      center: [event.venue.lng, event.venue.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      essential: true,
    });
    // Syncing local popup state to an external nav request (the list
    // view's "view on map" action), same justified pattern as
    // ThemeToggle's effect-driven state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenEventId(focusedEventId);
    // Only re-run when the parent hands us a genuinely new focus request
    // (focusNonce), not whenever focusedEventId itself changes — the
    // parent also nulls focusedEventId on every view-tab switch, and
    // reacting to that would fly back / reopen a stale card over
    // whatever the user navigated to manually in the meantime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, mapReady]);

  // Open/update/close the popup that expands a pin into its event card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const event = events.find((e) => e.id === openEventId);
    if (!event) {
      if (popupRef.current) {
        popupRef.current.popup.remove();
        popupRef.current.root.unmount();
        popupRef.current = null;
      }
      return;
    }

    if (!popupRef.current) {
      const el = document.createElement("div");
      const root = createRoot(el);
      const popup = new Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: "300px",
        anchor: "bottom",
        offset: 28,
      })
        .setLngLat([event.venue.lng, event.venue.lat])
        .setDOMContent(el)
        .addTo(map);
      popup.on("close", () => setOpenEventId(null));
      popupRef.current = { popup, root };
    } else {
      popupRef.current.popup.setLngLat([event.venue.lng, event.venue.lat]);
    }

    const venueEvents = eventsByVenue.get(event.venue.id) ?? [event];
    const indexAtVenue = venueEvents.findIndex((e) => e.id === event.id);

    popupRef.current.root.render(
      <PinPopupContent
        event={event}
        venueEvents={venueEvents}
        indexAtVenue={indexAtVenue}
        onCycle={setOpenEventId}
        setGoing={setGoing}
        setSaved={setSaved}
        attendanceResult={attendanceStatus[event.id]}
        onConfirmAttendance={onConfirmAttendance}
        onViewInList={onViewInList}
      />
    );
  }, [
    openEventId,
    events,
    attendanceStatus,
    mapReady,
    eventsByVenue,
    setGoing,
    setSaved,
    onConfirmAttendance,
    onViewInList,
  ]);

  return (
    <div className="lowfreq-map flex flex-col gap-3">
      <p className="font-mono text-[11px] text-kraft">tap a pin for details</p>
      {events.length === 0 ? (
        <MapEmptyState />
      ) : (
        <div
          ref={containerRef}
          role="region"
          aria-label="map of nearby shows"
          className="relative h-[420px] bg-surface border border-line rounded-[2px] overflow-hidden"
        />
      )}
    </div>
  );
}

function MapEmptyState() {
  return (
    <div className="h-[420px] bg-surface border border-line rounded-[2px] flex flex-col items-center justify-center text-center px-8 gap-2">
      <p className="font-display text-2xl tracking-wide">NOTHING NEARBY YET</p>
      <p className="font-mono text-[11px] text-kraft leading-relaxed max-w-[28ch]">
        lowfreq is invite-only and still small — an empty map means the
        scene here hasn&rsquo;t been mapped yet, not that something&rsquo;s
        broken. check back as more shows get posted.
      </p>
    </div>
  );
}

function MapPin({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group cursor-pointer"
      aria-label={`${name}${count > 1 ? ` — ${count} shows` : ""}`}
    >
      <span
        className={`w-3 h-3 rounded-full bg-riso-pink border border-surface group-hover:scale-125 transition-transform ${
          active ? "ring-2 ring-offset-2 ring-offset-surface ring-riso-pink scale-125" : ""
        }`}
      />
      <span className="font-mono text-[10px] text-ink bg-surface/95 border border-line px-1.5 py-0.5 rounded-[2px] whitespace-nowrap">
        {name}
        {count > 1 ? ` (${count})` : ""}
      </span>
    </button>
  );
}

function PinPopupContent({
  event,
  venueEvents,
  indexAtVenue,
  onCycle,
  setGoing,
  setSaved,
  attendanceResult,
  onConfirmAttendance,
  onViewInList,
}: {
  event: EventWithVenue;
  venueEvents: EventWithVenue[];
  indexAtVenue: number;
  onCycle: (eventId: string) => void;
  setGoing: (eventId: string, going: boolean) => void;
  setSaved: (eventId: string, saved: boolean) => void;
  attendanceResult: "pending" | "confirmed" | ConfirmAttendanceResult | undefined;
  onConfirmAttendance: (eventId: string) => void;
  onViewInList: (eventId: string) => void;
}) {
  return (
    <div className="w-[280px]">
      {venueEvents.length > 1 && (
        <div className="flex items-center justify-between px-1 pb-1.5 font-mono text-[10px] uppercase tracking-wide text-kraft">
          <button
            type="button"
            onClick={() =>
              onCycle(venueEvents[(indexAtVenue - 1 + venueEvents.length) % venueEvents.length].id)
            }
            aria-label="previous show at this venue"
            className="hover:text-ink transition-colors"
          >
            &lsaquo;
          </button>
          <span>
            {indexAtVenue + 1} of {venueEvents.length} shows here
          </span>
          <button
            type="button"
            onClick={() => onCycle(venueEvents[(indexAtVenue + 1) % venueEvents.length].id)}
            aria-label="next show at this venue"
            className="hover:text-ink transition-colors"
          >
            &rsaquo;
          </button>
        </div>
      )}
      <div className="rotate-[-0.4deg]">
        <EventCard
          event={event}
          setGoing={setGoing}
          setSaved={setSaved}
          attendanceResult={attendanceResult}
          onConfirmAttendance={onConfirmAttendance}
          onViewInList={onViewInList}
        />
      </div>
    </div>
  );
}
