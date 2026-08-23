import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const registerWithInvite = vi.fn();
vi.mock("@/app/signup/actions", () => ({
  registerWithInvite: (...args: unknown[]) => registerWithInvite(...args),
}));

import RegisterForm from "./RegisterForm";

describe("RegisterForm mid-flow invite invalidation", () => {
  afterEach(() => {
    cleanup();
    registerWithInvite.mockReset();
  });

  it("renders the registration fields for a token that was valid at page load", () => {
    render(<RegisterForm token="K7RX9QPL" />);

    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it("shows a clear explanation and offers no account when the invite was redeemed by someone else first", async () => {
    // Simulates the race: check_invite passed at page load, but
    // redeem_invite's atomic UPDATE found the row already used by the time
    // this submit reached the server.
    registerWithInvite.mockResolvedValue({ invalidInvite: true });

    render(<RegisterForm token="K7RX9QPL" />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText("THAT STAMP'S NO GOOD")).toBeTruthy()
    );
    expect(
      screen.getByText(/someone else redeemed this invite first/i)
    ).toBeTruthy();

    // No registration form left on screen — nothing left to submit again
    // with the dead token, and no account fields implying one was created.
    expect(screen.queryByLabelText(/username/i)).toBeNull();
    expect(screen.getByRole("link", { name: /back to start/i }).getAttribute("href")).toBe("/");
  });

  it("surfaces a real signup error (e.g. email taken) without claiming the invite is invalid", async () => {
    registerWithInvite.mockResolvedValue({ error: "An account with this email already exists." });

    render(<RegisterForm token="K7RX9QPL" />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText("An account with this email already exists.")).toBeTruthy()
    );
    // The form stays up (release_invite handed the token back server-side)
    // so the same stamp can be retried rather than dead-ending the visitor.
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
  });

  it("shows a distinct expired message rather than the generic invalid-invite copy", async () => {
    registerWithInvite.mockResolvedValue({ expired: true });

    render(<RegisterForm token="K7RX9QPL" />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("THAT STAMP EXPIRED")).toBeTruthy());
    expect(screen.queryByText(/someone else redeemed/i)).toBeNull();
  });

  it("offers a retry (not a dead end) when the GPS proximity check fails", async () => {
    registerWithInvite.mockResolvedValue({ locationMismatch: "too_far" });

    render(<RegisterForm token="K7RX9QPL" />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/doesn't look like you're there/i)).toBeTruthy()
    );
    const retryLink = screen.getByRole("link", { name: /try again/i });
    expect(retryLink.getAttribute("href")).toBe("/signup?token=K7RX9QPL");
  });
});
