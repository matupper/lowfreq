"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  confirmCheckinAttendance,
  type CheckinConfirmResult,
} from "@/app/checkin/[token]/actions";

const REASON_COPY: Record<string, string> = {
  invalid: "This code isn't valid anymore.",
  not_started: "This show hasn't started yet.",
  too_late: "This show's attendance window has closed.",
  error: "Something went wrong. Try again.",
};

// The session-present branch of /checkin/[token] — the signed-out branch
// reuses RegisterForm as-is instead (see the page component).
export default function CheckinConfirm({
  token,
  eventTitle,
  venueName,
}: {
  token: string;
  eventTitle: string;
  venueName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckinConfirmResult | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      setResult(await confirmCheckinAttendance(token));
    });
  }

  if (result?.ok) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOU&apos;RE MARKED IN.
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          &ldquo;I Was There&rdquo; confirmed for {eventTitle}.
        </p>
        <Link
          href="/home"
          className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
        >
          back to shows
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-8 justify-center">
      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          YOU&apos;RE HERE.
        </h1>
        <p className="text-sm text-kraft leading-relaxed pt-2 max-w-xs">
          {eventTitle} at {venueName}
        </p>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "confirming…" : "confirm you're here"}
      </button>

      {result && !result.ok && (
        <p className="font-mono text-[11px] text-stamp-red">
          {REASON_COPY[result.reason] ?? REASON_COPY.error}
        </p>
      )}
    </main>
  );
}
