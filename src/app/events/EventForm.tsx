"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { EventFormState } from "./eventFormState";

const inputClass =
  "bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft";
const labelClass = "font-mono text-[11px] text-kraft uppercase tracking-wide";

export type VenueOption = { id: string; name: string };

export type EventFormDefaults = {
  title: string;
  description: string;
  // Value for a datetime-local input (browser-local time, "YYYY-MM-DDTHH:mm").
  startTime: string;
  venueId: string;
  posterUrl: string | null;
};

// Shared by the create (events/new) and edit (events/[id]/edit) routes —
// same title/description/start_time/venue/poster fields either way, see
// docs/designdoc.md §9 Phase 4 items 1 and 3.
export default function EventForm({
  action,
  venues,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  venues: VenueOption[];
  defaults?: EventFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    action,
    null
  );
  const [posterPreview, setPosterPreview] = useState<string | null>(
    defaults?.posterUrl ?? null
  );

  function handlePosterChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-[2px] bg-surface-2 border border-line bg-cover bg-center shrink-0"
          style={posterPreview ? { backgroundImage: `url(${posterPreview})` } : undefined}
        />
        <label className="flex flex-col gap-1 cursor-pointer">
          <span className="font-mono text-xs text-riso-pink underline underline-offset-2">
            {posterPreview ? "change poster" : "add a poster (optional)"}
          </span>
          <span className="font-mono text-[10px] text-kraft">
            jpeg / png / webp / gif, up to 5MB
          </span>
          <input
            type="file"
            name="poster"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePosterChange}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelClass}>
          title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={defaults?.title}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaults?.description}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="startTime" className={labelClass}>
          date &amp; time
        </label>
        <input
          id="startTime"
          name="startTime"
          type="datetime-local"
          required
          defaultValue={defaults?.startTime}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="venueId" className={labelClass}>
          venue
        </label>
        <select
          id="venueId"
          name="venueId"
          required
          defaultValue={defaults?.venueId ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            pick a venue
          </option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
        <span className="font-mono text-[10px] text-kraft">
          don&rsquo;t see the venue? venue registration isn&rsquo;t open yet.
        </span>
      </div>

      {state?.error && (
        <p className="font-mono text-[11px] text-stamp-red">{state.error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 px-6 text-sm font-medium disabled:opacity-60"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="font-mono text-xs text-kraft">
          cancel
        </Link>
      </div>
    </form>
  );
}
