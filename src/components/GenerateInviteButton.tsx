"use client";

import { useTransition } from "react";
import { getCurrentLocation } from "@/lib/geolocation-client";
import { createInvite } from "@/app/profile/actions";

// Requests the generator's location (best-effort — denial doesn't block
// generation, see createInvite's comment) right before creating the
// invite, tied to this explicit tap so the browser's permission prompt
// appears in a context that makes sense to the user.
export default function GenerateInviteButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await getCurrentLocation();
      const location = result.status === "ok" ? { lat: result.reading.lat, lng: result.reading.lng } : null;
      await createInvite(location);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium w-full disabled:opacity-60"
    >
      {pending ? "stamping…" : "Stamp a new invite"}
    </button>
  );
}
