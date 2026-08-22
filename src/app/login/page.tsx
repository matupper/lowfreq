"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="space-y-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">
          LOG IN
        </h1>
        <p className="text-sm text-kraft leading-relaxed max-w-xs pt-2">
          Welcome back.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
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
            autoComplete="current-password"
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
          {pending ? "logging in…" : "log in"}
        </button>
      </form>

      <div className="border-t border-dashed border-line pt-6">
        <p className="font-mono text-xs text-kraft">
          new here? you&apos;ll need an invite —{" "}
          <Link href="/" className="text-riso-pink">
            get let in
          </Link>
        </p>
      </div>
    </main>
  );
}
