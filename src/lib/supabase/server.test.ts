import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_MAX_AGE_SECONDS } from "./cookie-options";

// @supabase/ssr 0.12.4 hardcodes the maxAge it writes for the session
// cookie to its own 400-day default and ignores createServerClient's
// `cookieOptions.maxAge` (confirmed by reading its source and reproducing
// against the real project — see cookie-options.ts). This test locks down
// the workaround: our own setAll callback must override whatever maxAge
// @supabase/ssr computed, on every cookie it writes, or "remember me"
// silently reverts to relying on an unconfigurable dependency default.
const setAllCookies = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: unknown) => void } }
  ) => {
    setAllCookies.mockImplementation(options.cookies.setAll);
    return {};
  },
}));

const cookieStoreSet = vi.fn();
const cookieStoreGetAll = vi.fn(() => []);

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: cookieStoreGetAll,
    set: cookieStoreSet,
  }),
}));

import { createClient } from "./server";

describe("createClient session cookie maxAge", () => {
  afterEach(() => {
    setAllCookies.mockReset();
    cookieStoreSet.mockReset();
  });

  it("overrides whatever maxAge @supabase/ssr computed with the app's configured session length", async () => {
    await createClient();

    // Simulate @supabase/ssr calling setAll after a sign-in, the way it
    // does internally — with its own hardcoded 400-day maxAge (34560000s),
    // to prove the override actually replaces a real-world value rather
    // than merely passing through an already-correct one.
    setAllCookies([
      {
        name: "sb-project-auth-token",
        value: "session-payload",
        options: { path: "/", sameSite: "lax", maxAge: 34560000 },
      },
    ]);

    expect(cookieStoreSet).toHaveBeenCalledWith(
      "sb-project-auth-token",
      "session-payload",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      })
    );
    // 90 days, not @supabase/ssr's 400-day default.
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 90);
  });

  it("passes through @supabase/ssr's maxAge: 0 deletion signal on sign-out instead of reviving the cookie", async () => {
    await createClient();

    // @supabase/ssr's signOut() calls setAll with maxAge: 0 to delete the
    // cookie, distinct from a real session write, which always carries a
    // truthy maxAge.
    setAllCookies([
      {
        name: "sb-project-auth-token",
        value: "",
        options: { path: "/", sameSite: "lax", maxAge: 0 },
      },
    ]);

    expect(cookieStoreSet).toHaveBeenCalledWith(
      "sb-project-auth-token",
      "",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        maxAge: 0,
      })
    );
  });
});
