"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { registerWithInvite, type RegisterState } from "@/app/signup/actions";
import { getCurrentLocation } from "@/lib/geolocation-client";
import type { GeoReading } from "@/lib/location";

export default function RegisterForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerWithInvite,
    null
  );

  // Requested as soon as the form mounts (right after a scan/manual-entry
  // deep link) rather than on submit, so there's no extra delay waiting on
  // the permission prompt at the moment they hit "create account". Silent
  // if unavailable — see registerWithInvite's comment on why a missing
  // reading degrades gracefully instead of blocking registration.
  const [location, setLocation] = useState<GeoReading | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCurrentLocation().then((result) => {
      if (!cancelled && result.status === "ok") {
        setLocation(result.reading);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state && "expired" in state) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide text-stamp-red">
          THAT STAMP EXPIRED
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          This invite timed out before you finished. Ask whoever gave it to
          you for a new one.
        </p>
        <Link
          href="/"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Back to start
        </Link>
      </main>
    );
  }

  if (state && "locationMismatch" in state) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide text-stamp-red">
          DOESN&apos;T LOOK LIKE YOU&apos;RE THERE
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          {state.locationMismatch === "stale"
            ? "Your location reading was too old to verify. Try again."
            : "This invite needs to be redeemed near where it was handed to you. Try again if you're actually there."}
        </p>
        <Link
          href={`/signup?token=${token}`}
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Try again
        </Link>
      </main>
    );
  }

  if (state && "invalidInvite" in state) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide text-stamp-red">
          THAT STAMP&apos;S NO GOOD
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          Someone else redeemed this invite first, or it&apos;s already been
          used. No account was created. Ask whoever invited you for a new
          stamp.
        </p>
        <Link
          href="/"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOU&apos;RE IN.
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs pt-2">
          Finish setting up your account.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="lat" value={location?.lat ?? ""} />
        <input type="hidden" name="lng" value={location?.lng ?? ""} />
        <input
          type="hidden"
          name="locationTimestamp"
          value={location?.timestamp ?? ""}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="username"
            className="font-mono text-[11px] text-kraft uppercase tracking-wide"
          >
            username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-mono text-[11px] text-kraft uppercase tracking-wide"
          >
            email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="font-mono text-[11px] text-kraft uppercase tracking-wide"
          >
            password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft focus:outline-none focus:border-kraft"
          />
        </div>

        {state?.error && (
          <p className="font-mono text-[11px] text-stamp-red">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium disabled:opacity-60 mt-2"
        >
          {pending ? "creating account…" : "create account"}
        </button>
      </form>
    </main>
  );
}
