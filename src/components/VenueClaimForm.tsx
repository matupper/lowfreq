"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { submitVenueClaim, type VenueClaimState } from "@/app/venues/claim/actions";
import { getCurrentLocation } from "@/lib/geolocation-client";

type VenueOption = { id: string; name: string; address: string | null };

export default function VenueClaimForm({ venues }: { venues: VenueOption[] }) {
  const [state, formAction, pending] = useActionState<VenueClaimState, FormData>(
    submitVenueClaim,
    null
  );
  const [mode, setMode] = useState<"existing" | "new">(
    venues.length > 0 ? "existing" : "new"
  );
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, startLocating] = useTransition();
  const [locationError, setLocationError] = useState(false);

  function useMyLocation() {
    startLocating(async () => {
      const result = await getCurrentLocation();
      if (result.status === "ok") {
        setLat(String(result.reading.lat));
        setLng(String(result.reading.lng));
        setLocationError(false);
      } else {
        setLocationError(true);
      }
    });
  }

  if (state && "success" in state) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-10">
        <h2 className="font-display text-2xl leading-none tracking-wide">
          CLAIM SUBMITTED
        </h2>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          An admin will review it. You&rsquo;ll see this venue on your
          profile once it&rsquo;s approved.
        </p>
        <Link
          href="/profile"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 px-6 text-sm font-medium"
        >
          back to profile
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="mode" value={mode} />

      {venues.length > 0 && (
        <div className="flex border border-line rounded-[2px] overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 py-2.5 text-sm font-medium ${
              mode === "existing" ? "bg-ink text-btn-on-ink" : "text-kraft"
            }`}
          >
            claim existing
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-2.5 text-sm font-medium ${
              mode === "new" ? "bg-ink text-btn-on-ink" : "text-kraft"
            }`}
          >
            not listed &mdash; register it
          </button>
        </div>
      )}

      {mode === "existing" ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="venueId"
            className="font-mono text-[11px] text-kraft uppercase tracking-wide"
          >
            venue
          </label>
          <select
            id="venueId"
            name="venueId"
            required
            defaultValue=""
            className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink focus:outline-none focus:border-kraft"
          >
            <option value="" disabled>
              select a venue&hellip;
            </option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.address ? ` — ${v.address}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="venueName"
              className="font-mono text-[11px] text-kraft uppercase tracking-wide"
            >
              venue name
            </label>
            <input
              id="venueName"
              name="venueName"
              type="text"
              required
              className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="venueAddress"
              className="font-mono text-[11px] text-kraft uppercase tracking-wide"
            >
              address
            </label>
            <input
              id="venueAddress"
              name="venueAddress"
              type="text"
              className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-[11px] text-kraft uppercase tracking-wide">
              location
            </label>
            <div className="flex gap-2">
              <input
                name="venueLat"
                type="text"
                inputMode="decimal"
                placeholder="lat"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                className="w-1/2 bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
              />
              <input
                name="venueLng"
                type="text"
                inputMode="decimal"
                placeholder="lng"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
                className="w-1/2 bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
              />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="font-mono text-[11px] text-riso-pink underline underline-offset-2 text-left disabled:opacity-60"
            >
              {locating ? "locating…" : "use my current location"}
            </button>
            {locationError && (
              <p className="font-mono text-[11px] text-stamp-red">
                Couldn&rsquo;t get your location — enter it by hand.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="note"
          className="font-mono text-[11px] text-kraft uppercase tracking-wide"
        >
          note for the admin (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft resize-none"
        />
      </div>

      {state && "error" in state && (
        <p className="font-mono text-[11px] text-stamp-red">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "submitting…" : "submit claim"}
      </button>
    </form>
  );
}
