"use client";

import { useState } from "react";
import type { EventWithVenue } from "./types";
import { fileReport, type ConfirmAttendanceResult } from "./actions";
import { REPORT_REASONS, type ReportReason } from "./constants";

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  wrong_info: "Wrong info",
  offensive: "Offensive",
  other: "Other",
};

function ReportModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ReportReason>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");

  async function handleSubmit() {
    setStatus("pending");
    const result = await fileReport(eventId, category, details);
    setStatus(result.ok ? "sent" : "error");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface border border-ink rounded-[2px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "sent" ? (
          <>
            <p className="text-sm">Thanks — this has been sent to the mods.</p>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors mt-4"
            >
              close
            </button>
          </>
        ) : (
          <>
            <h3 className="font-mono text-[11px] text-kraft uppercase tracking-wide">
              report this show
            </h3>
            <fieldset className="flex flex-col gap-2 mt-3">
              <legend className="sr-only">Reason</legend>
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason}
                    checked={category === reason}
                    onChange={() => setCategory(reason)}
                    className="accent-riso-pink"
                  />
                  {REPORT_REASON_LABELS[reason]}
                </label>
              ))}
            </fieldset>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else? (optional)"
              rows={3}
              className="w-full mt-3 bg-surface-2 border border-line rounded-[2px] px-3 py-2 text-sm text-ink placeholder:text-kraft resize-none"
            />
            {status === "error" && (
              <p className="font-mono text-[11px] text-stamp-red mt-2">
                couldn&rsquo;t send that — try again.
              </p>
            )}
            <div className="border-t border-dashed border-line mt-4 pt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === "pending"}
                className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-riso-pink text-riso-pink hover:bg-riso-pink/10 transition-colors disabled:opacity-60"
              >
                {status === "pending" ? "sending…" : "submit"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 border border-line text-kraft hover:border-kraft transition-colors"
              >
                cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
  const [reportOpen, setReportOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="font-mono text-[11px] uppercase tracking-wide text-kraft hover:text-ink transition-colors underline underline-offset-2 decoration-dotted"
        >
          report
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

      {reportOpen && (
        <ReportModal eventId={event.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
