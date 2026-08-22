import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const checkInviteCode = vi.fn();
vi.mock("@/app/join/actions", () => ({
  checkInviteCode: (...args: unknown[]) => checkInviteCode(...args),
}));

import OnboardingGate from "./OnboardingGate";

describe("OnboardingGate manual code entry", () => {
  afterEach(() => {
    cleanup();
    checkInviteCode.mockReset();
  });

  it("no account is reachable without opening manual entry or scanning", () => {
    render(<OnboardingGate initialManualOpen={false} />);

    expect(screen.getByRole("link", { name: /scan an invite stamp/i })).toBeTruthy();
    expect(screen.queryByLabelText(/invite code/i)).toBeNull();
  });

  it("shows a clear error and does not navigate on an invalid manually-entered code", async () => {
    checkInviteCode.mockResolvedValue({ error: "That code isn't valid — check it and try again." });

    render(<OnboardingGate initialManualOpen={true} />);

    fireEvent.change(screen.getByLabelText(/invite code/i), {
      target: { value: "BADCODE1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(
        screen.getByText("That code isn't valid — check it and try again.")
      ).toBeTruthy()
    );
    // Still on the gate — no registration form rendered as a result.
    expect(screen.queryByLabelText(/username/i)).toBeNull();
  });

  it("opens manual entry from the scan fallback deep link (?manual=1)", () => {
    render(<OnboardingGate initialManualOpen={true} />);
    expect(screen.getByLabelText(/invite code/i)).toBeTruthy();
  });
});
