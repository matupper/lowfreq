import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import ScanCamera from "./ScanCamera";

describe("ScanCamera camera-access fallback", () => {
  afterEach(() => {
    cleanup();
    push.mockClear();
    // @ts-expect-error -- test-only cleanup of a property we define per-test
    delete navigator.mediaDevices;
  });

  it("falls back to manual entry when camera permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied")) },
    });

    render(<ScanCamera />);

    await waitFor(() =>
      expect(screen.getByText("CAN'T REACH THE CAMERA")).toBeTruthy()
    );
    expect(
      screen.getByText(/camera access was denied/i)
    ).toBeTruthy();

    const manualLink = screen.getByRole("link", { name: /enter code manually/i });
    expect(manualLink.getAttribute("href")).toBe("/?manual=1");
  });

  it("falls back to manual entry when the browser has no camera API at all", async () => {
    // No navigator.mediaDevices defined at all (older/unsupported browser).
    render(<ScanCamera />);

    await waitFor(() =>
      expect(screen.getByText("CAN'T REACH THE CAMERA")).toBeTruthy()
    );
    expect(screen.getByText(/this browser can't open the camera/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /enter code manually/i }).getAttribute("href")
    ).toBe("/?manual=1");
  });
});
