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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() should not be reached in this test");
  }),
}));

import { registerWithInvite } from "./actions";

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

    const result = await registerWithInvite(null, formDataWithoutLocation());

    expect(result).not.toEqual(
      expect.objectContaining({ locationMismatch: expect.anything() })
    );
    // Proves it actually proceeded past the (skipped) proximity check to
    // redeem the invite, rather than merely tolerating an unrelated error.
    expect(rpc).toHaveBeenCalledWith("redeem_invite", { invite_token: "K7RX9QPL" });
    expect(result).toEqual({
      message: "Check your email to confirm your account, then log in.",
    });
  });
});
