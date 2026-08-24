import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// This page is the landing spot registerWithInvite (src/app/signup/actions.ts)
// redirects new members to right after a successful invite-redemption signup
// that requires email confirmation before a session exists — the captain's
// reported "already used" false error is what used to show in its place.
// These tests render the real page component (not a source-text grep) and
// assert what an actual visitor would see.
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims },
  }),
}));

const REDIRECT = Symbol("redirect");
type RedirectThrow = { [REDIRECT]: true; url: string };
const redirect = vi.fn((url: string) => {
  throw { [REDIRECT]: true, url } satisfies RedirectThrow;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

import CheckEmailPage from "./page";

function isRedirectThrow(thrown: unknown): thrown is RedirectThrow {
  return typeof thrown === "object" && thrown !== null && REDIRECT in thrown;
}

describe("CheckEmailPage", () => {
  afterEach(() => {
    cleanup();
    getClaims.mockReset();
    redirect.mockClear();
  });

  it("tells a signed-out visitor their account was created and shows the email a confirmation link was sent to", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    const element = await CheckEmailPage({
      searchParams: Promise.resolve({ email: "newmember@example.com" }),
    });
    render(element);

    expect(
      screen.getByRole("heading", { name: "CHECK YOUR EMAIL" })
    ).toBeTruthy();
    expect(screen.getByText("newmember@example.com")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to log in" }).getAttribute("href")
    ).toBe("/login");
  });

  it("falls back to generic copy when no email param is present, instead of rendering the literal string 'null'", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    const element = await CheckEmailPage({
      searchParams: Promise.resolve({}),
    });
    render(element);

    expect(screen.getByText(/we sent you a confirmation link/i)).toBeTruthy();
  });

  it("redirects a visitor who already has a session straight to /home instead of showing check-your-email", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

    let thrown: unknown;
    try {
      await CheckEmailPage({ searchParams: Promise.resolve({}) });
    } catch (e) {
      thrown = e;
    }

    expect(isRedirectThrow(thrown) && thrown.url).toBe("/home");
  });
});
