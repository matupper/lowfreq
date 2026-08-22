"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { checkInviteCode, type CheckInviteState } from "@/app/join/actions";

export default function OnboardingGate({
  initialManualOpen,
}: {
  initialManualOpen: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(initialManualOpen);
  const [state, formAction, pending] = useActionState<CheckInviteState, FormData>(
    checkInviteCode,
    null
  );

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col justify-between gap-10">
        <div className="space-y-1">
          <h1 className="font-display text-4xl leading-none tracking-wide">
            YOU DON&apos;T
            <br />
            JUST SIGN UP.
          </h1>
          <h1 className="font-display text-4xl leading-none tracking-wide text-stamp-red">
            SOMEONE LETS
            <br />
            YOU IN.
          </h1>
          <p className="text-sm text-kraft leading-relaxed max-w-xs pt-4">
            No open registration. Get invited by someone already inside, then
            scan their stamp in person to join.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-40 h-40 rounded-full border-2 border-ink/80 flex items-center justify-center -rotate-2">
            <div className="grid grid-cols-5 grid-rows-5 gap-1 w-24 h-24">
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-stamp-red rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
            </div>
          </div>
          <p className="font-mono text-[11px] text-kraft tracking-wide">
            every stamp is one-time and unique to who&apos;s giving it
          </p>
        </div>

        {manualOpen ? (
          <form action={formAction} className="flex flex-col gap-3">
            <label
              htmlFor="code"
              className="font-mono text-[11px] text-kraft uppercase tracking-wide"
            >
              invite code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="K7RX-9QPL"
              className="bg-surface border border-line rounded-[2px] px-3.5 py-3 text-sm text-ink placeholder:text-kraft/60 focus:outline-none focus:border-kraft font-mono tracking-wider"
            />
            {state?.error && (
              <p className="font-mono text-[11px] text-stamp-red">
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "checking…" : "continue"}
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="text-kraft font-mono text-xs py-1.5"
            >
              back
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link
              href="/join/scan"
              className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium text-center"
            >
              Scan an invite stamp
            </Link>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="text-kraft font-mono text-xs py-1.5"
            >
              Have a code instead? Enter it manually
            </button>
            <div className="border-t border-dashed border-line pt-4 mt-1 text-center">
              <p className="font-mono text-xs text-kraft">
                already inside?{" "}
                <Link href="/login" className="text-ink underline underline-offset-2">
                  log in
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
