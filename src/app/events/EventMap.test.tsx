import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventMap from "./EventMap";
import type { EventWithVenue } from "./types";

// jsdom has no WebGL/canvas support, so the real maplibre-gl can't run in
// tests. This mock keeps just enough surface area for EventMap's usage:
// a Map that "loads" asynchronously (like the real one), and Marker/Popup
// that attach their DOM content to the map container so the resulting
// EventCard content is queryable the same way it is in EventsBrowser's
// list-view tests. Defined inline in the factory since vi.mock is hoisted
// above any top-level const/class declarations in this file.
vi.mock("maplibre-gl", () => {
  type Listener = () => void;

  class FakeMap {
    _container: HTMLElement;
    _loadListeners: Listener[] = [];
    constructor(opts: { container: HTMLElement }) {
      this._container = opts.container;
      // Real maplibre fires "load" asynchronously once tiles/style are
      // ready — mirror that so effects gated on mapReady behave the same.
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
  };
});

function makeEvent(overrides: Partial<EventWithVenue> = {}): EventWithVenue {
  return {
    id: "event-1",
    title: "Basement Show",
    description: null,
    startTime: "2026-09-01T02:00:00Z",
    displayTime: "sep 1",
    venue: { id: "venue-1", name: "The Basement", address: null, lat: 45.5, lng: -122.6 },
    goingCount: 0,
    myGoing: false,
    mySaved: false,
    hasStarted: false,
    attendedAt: null,
    ...overrides,
  };
}

function renderMap(overrides: Partial<Parameters<typeof EventMap>[0]> = {}) {
  const setGoing = vi.fn();
  const setSaved = vi.fn();
  const onConfirmAttendance = vi.fn();
  const onViewInList = vi.fn();
  const props = {
    events: [makeEvent()],
    focusedEventId: null,
    focusNonce: 0,
    setGoing,
    setSaved,
    attendanceStatus: {},
    onConfirmAttendance,
    onViewInList,
    ...overrides,
  };
  render(<EventMap {...props} />);
  return { setGoing, setSaved, onConfirmAttendance, onViewInList };
}

describe("EventMap", () => {
  afterEach(() => cleanup());

  it("shows the invite-only empty state instead of a silent blank map", () => {
    renderMap({ events: [] });
    expect(screen.getByText(/nothing nearby yet/i)).toBeTruthy();
    expect(screen.getByText(/invite-only and still small/i)).toBeTruthy();
  });

  it("plots a pin per venue and expands it into the event card on click", async () => {
    renderMap();

    const pin = await waitFor(() => screen.getByRole("button", { name: "The Basement" }));
    expect(screen.queryByText("Basement Show")).toBeNull();

    fireEvent.click(pin);

    await waitFor(() => expect(screen.getByText("Basement Show")).toBeTruthy());
    // The same RSVP controls as the list view's card are usable in place.
    expect(screen.getByRole("button", { name: "going" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "save" })).toBeTruthy();
  });

  it("clicking the same pin again closes the expanded card", async () => {
    renderMap();
    const pin = await waitFor(() => screen.getByRole("button", { name: "The Basement" }));

    fireEvent.click(pin);
    await waitFor(() => expect(screen.getByText("Basement Show")).toBeTruthy());

    fireEvent.click(pin);
    await waitFor(() => expect(screen.queryByText("Basement Show")).toBeNull());
  });

  it("lets the expanded card RSVP without leaving the map", async () => {
    const { setGoing } = renderMap();
    const pin = await waitFor(() => screen.getByRole("button", { name: "The Basement" }));
    fireEvent.click(pin);

    const goingButton = await waitFor(() => screen.getByRole("button", { name: "going" }));
    fireEvent.click(goingButton);

    expect(setGoing).toHaveBeenCalledWith("event-1", true);
  });

  it("jumps to the list view from the expanded card", async () => {
    const { onViewInList } = renderMap();
    const pin = await waitFor(() => screen.getByRole("button", { name: "The Basement" }));
    fireEvent.click(pin);

    const viewInList = await waitFor(() => screen.getByRole("button", { name: "view in list" }));
    fireEvent.click(viewInList);

    expect(onViewInList).toHaveBeenCalledWith("event-1");
  });

  it("opens the right pin's card when the list view asks to focus an event", async () => {
    const events = [
      makeEvent({ id: "event-1", venue: { id: "venue-1", name: "The Basement", address: null, lat: 45.5, lng: -122.6 } }),
      makeEvent({
        id: "event-2",
        title: "Warehouse Set",
        venue: { id: "venue-2", name: "Kelly's Garage", address: null, lat: 45.55, lng: -122.67 },
      }),
    ];
    renderMap({ events, focusedEventId: "event-2", focusNonce: 1 });

    await waitFor(() => expect(screen.getByText("Warehouse Set")).toBeTruthy());
    expect(screen.queryByText("Basement Show")).toBeNull();
  });

  it("cycles between multiple shows at the same venue from within the card", async () => {
    const venue = { id: "venue-1", name: "The Basement", address: null, lat: 45.5, lng: -122.6 };
    const events = [
      makeEvent({ id: "event-1", title: "Early Set", venue }),
      makeEvent({ id: "event-2", title: "Late Set", venue }),
    ];
    renderMap({ events });

    const pin = await waitFor(() => screen.getByRole("button", { name: /The Basement/ }));
    fireEvent.click(pin);

    await waitFor(() => expect(screen.getByText("Early Set")).toBeTruthy());
    expect(screen.getByText(/1 of 2 shows here/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /next show/i }));
    await waitFor(() => expect(screen.getByText("Late Set")).toBeTruthy());
  });
});
