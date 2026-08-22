import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventsBrowser from "./EventsBrowser";
import type { EventWithVenue } from "./types";

function makeEvent(overrides: Partial<EventWithVenue> = {}): EventWithVenue {
  return {
    id: "event-1",
    title: "Basement Show",
    description: null,
    startTime: "2026-09-01T02:00:00Z",
    displayTime: "sep 1",
    venue: { id: "venue-1", name: "The Basement", address: null, lat: 0, lng: 0 },
    goingCount: 0,
    myGoing: false,
    mySaved: false,
    ...overrides,
  };
}

// Simulates network latency: the server action doesn't resolve until the
// test explicitly releases it, so we can observe UI state mid-flight.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("EventsBrowser RSVP optimistic update", () => {
  afterEach(() => cleanup());

  it("updates the going count immediately on click, before the server action resolves", async () => {
    const { promise, resolve } = deferred<void>();
    const setGoing = vi.fn().mockReturnValue(promise);
    const setSaved = vi.fn();

    render(
      <EventsBrowser events={[makeEvent()]} setGoing={setGoing} setSaved={setSaved} />
    );

    fireEvent.click(screen.getByRole("button", { name: "going" }));

    // Assert before the server action promise ever resolves — this is
    // exactly the perceived-latency bug: previously the UI only updated
    // once this awaited.
    await waitFor(() => {
      expect(screen.getByText(/1 going/)).toBeTruthy();
    });
    expect(setGoing).toHaveBeenCalledWith("event-1", true);

    resolve();
    await waitFor(() => expect(screen.queryByText(/couldn't save/)).toBeNull());
  });

  it("rolls back the optimistic update and shows an error when the server action fails", async () => {
    const setGoing = vi.fn().mockRejectedValue(new Error("db unavailable"));
    const setSaved = vi.fn();

    render(
      <EventsBrowser events={[makeEvent()]} setGoing={setGoing} setSaved={setSaved} />
    );

    fireEvent.click(screen.getByRole("button", { name: "going" }));

    // Optimistic bump appears immediately...
    await waitFor(() => expect(screen.getByText(/1 going/)).toBeTruthy());

    // ...then reverts once the server action rejects, since the events
    // prop was never updated to confirm the change, and an error is shown.
    await waitFor(() =>
      expect(screen.getByText(/couldn't save that rsvp/)).toBeTruthy()
    );
    await waitFor(() => expect(screen.queryByText(/1 going/)).toBeNull());
  });

  it("toggles going off when clicked while already going", async () => {
    const setGoing = vi.fn().mockResolvedValue(undefined);
    const setSaved = vi.fn();

    render(
      <EventsBrowser
        events={[makeEvent({ myGoing: true, goingCount: 1 })]}
        setGoing={setGoing}
        setSaved={setSaved}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "going" }));

    await waitFor(() => expect(screen.queryByText(/1 going/)).toBeNull());
    expect(setGoing).toHaveBeenCalledWith("event-1", false);
  });

  it("saving a show is independent of going status", async () => {
    const setGoing = vi.fn();
    const setSaved = vi.fn().mockResolvedValue(undefined);

    render(
      <EventsBrowser events={[makeEvent()]} setGoing={setGoing} setSaved={setSaved} />
    );

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(setSaved).toHaveBeenCalledWith("event-1", true));
    expect(setGoing).not.toHaveBeenCalled();
    // Saving doesn't touch the public going count.
    expect(screen.queryByText(/1 going/)).toBeNull();
  });
});
