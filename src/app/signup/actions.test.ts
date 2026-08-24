import { afterEach, describe, expect, it, vi } from "vitest";

// registerWithInvite submits "" for lat/lng/locationTimestamp (not omitted
// fields) when RegisterForm never got a GPS fix. Number("") is 0, which
// Number.isFinite happily accepts, so a naive coercion would treat "no
// reading" as a reading of (0, 0) and run it through the proximity check —
// almost certainly failing "too_far" against a real inviter location and
// blocking registration for anyone without location access. This test
// reproduces that exact scenario against the real server action.
const rpc = vi.fn();
const signUp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc,
    auth: { signUp },
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://lowfreq.example" }),
}));

// Mirrors real next/navigation: redirect() throws to abort the calling
// function rather than returning, so callers observe it via a thrown
// sentinel rather than a normal return value.
const REDIRECT = Symbol("redirect");
type RedirectThrow = { [REDIRECT]: true; url: string };
const redirect = vi.fn((url: string) => {
  throw { [REDIRECT]: true, url } satisfies RedirectThrow;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

import { registerWithInvite } from "./actions";

function isRedirectThrow(thrown: unknown): thrown is RedirectThrow {
  return typeof thrown === "object" && thrown !== null && REDIRECT in thrown;
}

async function captureRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (thrown) {
    if (isRedirectThrow(thrown)) {
      return thrown.url;
    }
    throw thrown;
  }
  throw new Error("expected registerWithInvite to redirect, but it returned normally");
}

function formDataWithoutLocation(): FormData {
  const fd = new FormData();
  fd.set("token", "K7RX9QPL");
  fd.set("username", "newuser");
  fd.set("email", "new@example.com");
  fd.set("password", "hunter22");
  // What RegisterForm actually submits when it has no GPS fix: empty
  // strings, not missing fields (see RegisterForm.tsx's hidden inputs).
  fd.set("lat", "");
  fd.set("lng", "");
  fd.set("locationTimestamp", "");
  return fd;
}

describe("registerWithInvite location handling", () => {
  afterEach(() => {
    rpc.mockReset();
    signUp.mockReset();
    redirect.mockClear();
  });

  it("skips the proximity check (does not report locationMismatch) when the client submitted no GPS reading", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "invite_location") {
        // Inviter was far from (0, 0) — if the empty-string reading were
        // ever coerced to (0, 0), this would fail the proximity check.
        return { data: [{ lat: 34.0537, lng: -118.2428 }], error: null };
      }
      if (fn === "redeem_invite") {
        return { data: [{ invite_id: "invite-1" }], error: null };
      }
      throw new Error(`unexpected rpc: ${fn}`);
    });
    signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const url = await captureRedirect(
      registerWithInvite(null, formDataWithoutLocation())
    );

    expect(url).not.toMatch(/locationMismatch/);
    // Proves it actually proceeded past the (skipped) proximity check to
    // redeem the invite, rather than merely tolerating an unrelated error.
    expect(rpc).toHaveBeenCalledWith("redeem_invite", { invite_token: "K7RX9QPL" });
    expect(url).toBe("/signup/check-email?email=new%40example.com");
  });
});

// The actual production bug (captain repro, 2026-08-24): signup succeeded
// and the invite was correctly marked used, but the visitor was shown
// "invite already used" and lost their progress. Root cause traced to
// src/app/signup/page.tsx re-deriving "is this invite still valid" from
// the DB on every render of /signup?token=…, combined with Next.js
// automatically re-rendering the current route's Server Components
// whenever a Server Action sets a cookie (see next/dist/docs' "Cookies"
// section under Mutating Data) — which @supabase/ssr's setAll does
// unconditionally inside signUp() (@supabase/ssr's dist/module/cookies.js,
// storage.setItem/removeItem both call setAll). Once redeem_invite marks
// the token 'used', that automatic re-render sees 'used' and swaps in
// signup/page.tsx's "already used" screen in place of whatever the
// in-flight action's result would otherwise have shown — silently
// discarding it. Returning inline useActionState data for "awaiting email
// confirmation" (as the code used to) sits behind exactly that swap;
// redirecting to a route that isn't gated on this invite's status does
// not.
describe("registerWithInvite email-confirmation-required outcome", () => {
  afterEach(() => {
    rpc.mockReset();
    signUp.mockReset();
    redirect.mockClear();
  });

  function formDataWithLocation(email: string): FormData {
    const fd = new FormData();
    fd.set("token", "K7RX9QPL");
    fd.set("username", "School mati");
    fd.set("email", email);
    fd.set("password", "hunter222");
    fd.set("lat", "");
    fd.set("lng", "");
    fd.set("locationTimestamp", "");
    return fd;
  }

  it("redirects to the dedicated check-email screen — not an inline state a client re-render can discard — when signUp succeeds without a session", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "invite_location") return { data: [{ lat: null, lng: null }], error: null };
      if (fn === "redeem_invite") return { data: [{ invite_id: "invite-1" }], error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });
    // What Supabase actually returns for this project (confirmed against
    // lowfreq-dev): signUp succeeds, the user row exists, but no session
    // because email confirmation is required.
    signUp.mockResolvedValue({ data: { session: null }, error: null });

    const url = await captureRedirect(
      registerWithInvite(null, formDataWithLocation("newmember@example.com"))
    );

    expect(url).toBe("/signup/check-email?email=newmember%40example.com");
    // Never re-checks invite status after redeeming — that's the
    // server-side re-check that used to clobber this outcome.
    expect(rpc).not.toHaveBeenCalledWith(
      "invite_lookup_status",
      expect.anything()
    );
    // The invite must not be handed back — the account really was
    // created and the stamp was correctly consumed exactly once.
    expect(rpc).not.toHaveBeenCalledWith("release_invite", expect.anything());
  });

  it("still redirects home when signUp does return a session (email confirmation not required)", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "invite_location") return { data: [{ lat: null, lng: null }], error: null };
      if (fn === "redeem_invite") return { data: [{ invite_id: "invite-1" }], error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });
    signUp.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    const url = await captureRedirect(
      registerWithInvite(null, formDataWithLocation("confirmed@example.com"))
    );

    expect(url).toBe("/home");
  });
});
