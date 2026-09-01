"use client";

import type { EventWithVenue } from "./types";
import type { ConfirmAttendanceResult } from "./actions";

function AttendanceMessage({ result }: { result: ConfirmAttendanceResult }) {
  if (result.ok) return null;
  const message: Record<Extract<ConfirmAttendanceResult, { ok: false }>["reason"], string> = {
    not_started: "This show hasn't started yet.",
    too_late: "This show started too long ago to confirm with GPS.",
    too_far: "Doesn't look like you're at the venue — try again if you are.",
    stale: "Your location reading was too old — try again.",
    // Strict GPS-or-nothing, no manual fallback — captain decision on the
    // open question in docs/designdoc.md §10, revisit once venue-printed
    // check-in QR (Phase 4) ships. See events/actions.ts confirmAttendance.
    no_location: "Couldn't confirm — location access is needed to verify you're at the show.",
    error: "Couldn't confirm right now — try again.",
  };
  return (
    <p className="font-mono text-[11px] text-stamp-red mt-2">
      {message[result.reason]}
    </p>
  );
}

export default function EventCard({
  event,
  rotation = "",
  focused = false,
  setGoing,
  setSaved,
  attendanceResult,
  onConfirmAttendance,
  onViewOnMap,
  onViewInList,
}: {
  event: EventWithVenue;
  rotation?: string;
  focused?: boolean;
  setGoing: (eventId: string, going: boolean) => void;
  setSaved: (eventId: string, saved: boolean) => void;
  attendanceResult: "pending" | "confirmed" | ConfirmAttendanceResult | undefined;
  onConfirmAttendance: (eventId: string) => void;
  // Present only on the list view's cards — jumps to this event on the map.
  onViewOnMap?: (eventId: string) => void;
  // Present only on the map's expanded pin card — jumps to this event in the list.
  onViewInList?: (eventId: string) => void;
}) {
  const attended = event.attendedAt !== null || attendanceResult === "confirmed";

  return (
    <div
      className={`bg-surface border border-ink rounded-[2px] p-5 ${rotation} ${
        focused ? "ring-2 ring-riso-pink" : ""
      }`}
    >
      {event.posterUrl && (
        <div
          className="-mx-5 -mt-5 mb-4 aspect-[4/3] bg-surface-2 bg-cover bg-center rounded-t-[1px]"
          style={{ backgroundImage: `url(${event.posterUrl})` }}
        />
      )}
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
        {event.hasStarted ? (
          attended ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-kraft border border-riso-pink rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-riso-pink" />
              you were there
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onConfirmAttendance(event.id)}
              disabled={attendanceResult === "pending"}
              className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors disabled:opacity-60"
            >
              {attendanceResult === "pending" ? "checking…" : "i was there"}
            </button>
          )
        ) : (
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
        )}
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
        {onViewOnMap && (
          <button
            type="button"
            onClick={() => onViewOnMap(event.id)}
            className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors ml-auto"
          >
            view on map
          </button>
        )}
        {onViewInList && (
          <button
            type="button"
            onClick={() => onViewInList(event.id)}
            className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors ml-auto"
          >
            view in list
          </button>
        )}
      </div>

      {attendanceResult && attendanceResult !== "pending" && attendanceResult !== "confirmed" && (
        <AttendanceMessage result={attendanceResult} />
      )}
    </div>
  );
}
