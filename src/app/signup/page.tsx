"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, null);

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

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          SIGN UP
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs pt-2">
          Plain signup, temporary — invite-only gating comes later.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="font-mono text-[11px] text-kraft uppercase tracking-wide"
          >
            name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
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

      <div className="border-t border-dashed border-line pt-6">
        <p className="font-mono text-xs text-kraft">
          already have an account?{" "}
          <Link href="/login" className="text-riso-pink">
            log in
          </Link>
        </p>
      </div>
    </main>
  );
}
