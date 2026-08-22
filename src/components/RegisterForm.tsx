"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerWithInvite, type RegisterState } from "@/app/signup/actions";

export default function RegisterForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerWithInvite,
    null
  );

  if (state && "message" in state) {
    return (
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-6 justify-center">
        <h1 className="font-display text-3xl leading-none tracking-wide">
          CHECK YOUR EMAIL
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs">
          {state.message}
        </p>
        <Link href="/login" className="font-mono text-xs text-riso-pink">
          back to log in
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
