"use client";

import { useState, useTransition } from "react";
import { getOrCreateCheckinCode } from "@/app/venues/mine/actions";
import { checkinJoinUrl } from "@/lib/invites";
import VenueCheckinQR from "./VenueCheckinQR";

export default function GenerateCheckinButton({
  eventId,
  origin,
}: {
  eventId: string;
  origin: string;
}) {
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await getOrCreateCheckinCode(eventId);
        setToken(result);
        setError(false);
      } catch {
        setError(true);
      }
    });
  }

  // The action just returned this token, so it's freshly minted — no
  // reason it'd already be expired.
  if (token) {
    return (
      <VenueCheckinQR joinUrl={checkinJoinUrl(origin, token)} token={token} expired={false} />
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="font-mono text-[11px] text-riso-pink border border-riso-pink rounded-full px-3 py-1 disabled:opacity-60"
      >
        {pending ? "generating…" : "generate check-in code"}
      </button>
      {error && (
        <p className="font-mono text-[11px] text-stamp-red">
          Couldn&rsquo;t generate a code. Try again.
        </p>
      )}
    </div>
  );
}
