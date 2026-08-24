import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import EventsBrowser from "./EventsBrowser";
import type { EventWithVenue } from "./types";

// jsdom doesn't implement scrollIntoView — EventsBrowser's "scroll to the
// focused event" effect (used by the map's "view in list" jump) calls it,
// so stub it for this file's tests.
HTMLElement.prototype.scrollIntoView = vi.fn();

const getCurrentLocation = vi.fn();
vi.mock("@/lib/geolocation-client", () => ({
  getCurrentLocation: (...args: unknown[]) => getCurrentLocation(...args),
}));

// jsdom has no WebGL/canvas support, so the real maplibre-gl (loaded by
// EventMap, which EventsBrowser pulls in via next/dynamic) can't run in
// tests — see the fuller version of this mock's reasoning in
// EventMap.test.tsx. Defined inline since vi.mock is hoisted.
vi.mock("maplibre-gl", () => {
  type Listener = () => void;

  class FakeMap {
    _container: HTMLElement;
    _loadListeners: Listener[] = [];
    constructor(opts: { container: HTMLElement }) {
      this._container = opts.container;
      queueMicrotask(() => this._loadListeners.forEach((l) => l()));
    }
    addControl() {
      return this;
    }
    on(event: string, cb: Listener) {
      if (event === "load") this._loadListeners.push(cb);
      return this;
    }
    jumpTo() {}
    fitBounds() {}
    flyTo() {}
    getZoom() {
      return 12;
    }
    setStyle() {}
    remove() {}
  }

  class FakeMarker {
    _element: HTMLElement;
    constructor(opts: { element: HTMLElement }) {
      this._element = opts.element;
    }
    setLngLat() {
      return this;
    }
    addTo(map: FakeMap) {
      map._container.appendChild(this._element);
      return this;
    }
    remove() {
      this._element.remove();
    }
  }

  class FakePopup {
    _element: HTMLElement | null = null;
    _closeListeners: Listener[] = [];
    setLngLat() {
      return this;
    }
    setDOMContent(el: HTMLElement) {
      this._element = el;
      return this;
    }
    addTo(map: FakeMap) {
      if (this._element) map._container.appendChild(this._element);
      return this;
    }
    on(event: string, cb: Listener) {
      if (event === "close") this._closeListeners.push(cb);
      return this;
    }
    remove() {
      if (this._element?.parentNode) {
        this._element.remove();
        this._closeListeners.forEach((l) => l());
      }
    }
  }

  return {
    MapLibreMap: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    NavigationControl: class {},
    LngLatBounds: class {
      extend() {
        return this;
      }
    },
    setWorkerUrl: vi.fn(),
  };
});

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
    hasStarted: false,
    attendedAt: null,
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
  afterEach(() => {
    cleanup();
    getCurrentLocation.mockReset();
  });

  it("updates the going count immediately on click, before the server action resolves", async () => {
    const { promise, resolve } = deferred<void>();
    const setGoing = vi.fn().mockReturnValue(promise);
    const setSaved = vi.fn();
    const confirmAttendance = vi.fn();

    render(
      <EventsBrowser
        events={[makeEvent()]}
        setGoing={setGoing}
        setSaved={setSaved}
        confirmAttendance={confirmAttendance}
      />
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
    const confirmAttendance = vi.fn();

    render(
      <EventsBrowser
        events={[makeEvent()]}
        setGoing={setGoing}
        setSaved={setSaved}
        confirmAttendance={confirmAttendance}
      />
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
    const confirmAttendance = vi.fn();

    render(
      <EventsBrowser
        events={[makeEvent({ myGoing: true, goingCount: 1 })]}
        setGoing={setGoing}
        setSaved={setSaved}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "going" }));

    await waitFor(() => expect(screen.queryByText(/1 going/)).toBeNull());
    expect(setGoing).toHaveBeenCalledWith("event-1", false);
  });

  it("saving a show is independent of going status", async () => {
    const setGoing = vi.fn();
    const setSaved = vi.fn().mockResolvedValue(undefined);
    const confirmAttendance = vi.fn();

    render(
      <EventsBrowser
        events={[makeEvent()]}
        setGoing={setGoing}
        setSaved={setSaved}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(setSaved).toHaveBeenCalledWith("event-1", true));
    expect(setGoing).not.toHaveBeenCalled();
    // Saving doesn't touch the public going count.
    expect(screen.queryByText(/1 going/)).toBeNull();
  });
});

describe("EventsBrowser attendance ('I Was There')", () => {
  afterEach(() => {
    cleanup();
    getCurrentLocation.mockReset();
  });

  it("shows the going button, not I Was There, for an event that hasn't started", () => {
    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: false })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "going" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /i was there/i })).toBeNull();
  });

  it("shows an I Was There button instead of going once the event has started", () => {
    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /i was there/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "going" })).toBeNull();
  });

  it("shows a confirmed badge instead of the button once attendance is already recorded", () => {
    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true, attendedAt: "2026-08-22T10:00:00Z" })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={vi.fn()}
      />
    );

    expect(screen.getByText(/you were there/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /i was there/i })).toBeNull();
  });

  it("captures a location reading and confirms attendance on tap", async () => {
    getCurrentLocation.mockResolvedValue({
      status: "ok",
      reading: { lat: 1, lng: 2, accuracy: 5, timestamp: Date.now() },
    });
    const confirmAttendance = vi.fn().mockResolvedValue({ ok: true });

    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /i was there/i }));

    await waitFor(() =>
      expect(confirmAttendance).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ lat: 1, lng: 2 })
      )
    );
    await waitFor(() => expect(screen.getByText(/you were there/i)).toBeTruthy());
  });

  it("shows a clear message and no fallback when location is unavailable", async () => {
    getCurrentLocation.mockResolvedValue({ status: "denied" });
    const confirmAttendance = vi.fn().mockResolvedValue({ ok: false, reason: "no_location" });

    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /i was there/i }));

    await waitFor(() =>
      expect(confirmAttendance).toHaveBeenCalledWith("event-1", null)
    );
    await waitFor(() =>
      expect(screen.getByText(/location access is needed/i)).toBeTruthy()
    );
    // Strict GPS-or-nothing per the captain decision on §10 — no manual
    // "confirm anyway" option is offered.
    expect(screen.queryByRole("button", { name: /confirm anyway/i })).toBeNull();
  });

  it("shows a retryable message when the GPS proximity check fails", async () => {
    getCurrentLocation.mockResolvedValue({
      status: "ok",
      reading: { lat: 50, lng: 50, accuracy: 5, timestamp: Date.now() },
    });
    const confirmAttendance = vi.fn().mockResolvedValue({ ok: false, reason: "too_far" });

    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /i was there/i }));

    await waitFor(() =>
      expect(screen.getByText(/doesn't look like you're at the venue/i)).toBeTruthy()
    );
    // Button remains so the user can retry.
    expect(screen.getByRole("button", { name: /i was there/i })).toBeTruthy();
  });

  it("shows a non-retryable message when the event started too long ago for GPS confirmation", async () => {
    getCurrentLocation.mockResolvedValue({
      status: "ok",
      reading: { lat: 1, lng: 2, accuracy: 5, timestamp: Date.now() },
    });
    const confirmAttendance = vi.fn().mockResolvedValue({ ok: false, reason: "too_late" });

    render(
      <EventsBrowser
        events={[makeEvent({ hasStarted: true })]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={confirmAttendance}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /i was there/i }));

    await waitFor(() =>
      expect(screen.getByText(/started too long ago to confirm with gps/i)).toBeTruthy()
    );
  });
});

describe("EventsBrowser list <-> map navigation", () => {
  afterEach(() => cleanup());

  it("jumps from a list card to that event's pin on the map", async () => {
    render(
      <EventsBrowser
        events={[makeEvent()]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "view on map" }));

    // Map tab is now active and the event's card is already expanded —
    // not just a blank map or a switched tab with no context.
    await waitFor(() => expect(screen.getAllByText("Basement Show").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "map" }).className).toContain("bg-ink");
  });

  it("jumps from the map's expanded card back to the matching list card", async () => {
    render(
      <EventsBrowser
        events={[makeEvent()]}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        confirmAttendance={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "view on map" }));
    const viewInList = await waitFor(() => screen.getByRole("button", { name: "view in list" }));
    fireEvent.click(viewInList);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "list" }).className).toContain("bg-ink")
    );
    // The map view stays mounted (just hidden) in the background so its
    // camera/popup state survives tab switches — scope to the list card
    // specifically (by its id) rather than asserting on the whole document,
    // since the map's own copy of this event's card is still in the DOM.
    const listCard = document.getElementById("event-event-1")!;
    expect(within(listCard).getByRole("button", { name: "going" })).toBeTruthy();
  });
});
