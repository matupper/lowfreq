import { afterEach, describe, expect, it, vi } from "vitest";

// Reproduces the captain's "existing test account stopped working" report.
// Investigation traced it to Supabase Auth itself rejecting the password
// (real auth logs showed grant_type=password /token requests failing with
// error_code=invalid_credentials) — not a bug in this action or in the
// invite-gating/location-verification code that landed around the same
// time. This locks down the two outcomes signInWithPassword can produce so
// a future change to this action (e.g. swallowing the error, or redirecting
// on failure) is caught even though the credential mismatch itself wasn't
// a code bug.
const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() should not be reached in this test");
  }),
}));

import { redirect } from "next/navigation";
import { login } from "./actions";

function loginFormData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("login", () => {
  afterEach(() => {
    signInWithPassword.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("surfaces Supabase Auth's rejection instead of redirecting on a bad password", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await login(null, loginFormData("captain@example.com", "wrong-password"));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "captain@example.com",
      password: "wrong-password",
    });
    expect(result).toEqual({ error: "Invalid login credentials" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /home once Supabase Auth accepts the credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "token" }, user: { id: "user-1" } },
      error: null,
    });

    await expect(
      login(null, loginFormData("captain@example.com", "correct-password"))
    ).rejects.toThrow("redirect() should not be reached in this test");

    expect(redirect).toHaveBeenCalledWith("/home");
  });
});
