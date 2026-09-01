import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import EventCard from "./EventCard";
import type { EventWithVenue } from "./types";

function makeEvent(overrides: Partial<EventWithVenue> = {}): EventWithVenue {
  return {
    id: "event-1",
    title: "Basement Show",
    description: null,
    startTime: "2026-09-01T02:00:00Z",
    displayTime: "sep 1",
    dateKey: "2026-09-01",
    venue: { id: "venue-1", name: "The Basement", address: null, lat: 0, lng: 0 },
    goingCount: 0,
    myGoing: false,
    mySaved: false,
    hasStarted: false,
    attendedAt: null,
    posterUrl: null,
    ...overrides,
  };
}

describe("EventCard poster slot", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders today's pure-text treatment when posterUrl is absent", () => {
    const { container } = render(
      <EventCard
        event={makeEvent({ posterUrl: null })}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        attendanceResult={undefined}
        onConfirmAttendance={vi.fn()}
      />,
    );

    expect(container.querySelector("[style*='background-image']")).toBeNull();
  });

  it("renders the poster as the card's header/thumbnail when posterUrl is present", () => {
    const posterUrl = "https://example.com/posters/event-1/poster.jpg?v=123";
    const { container } = render(
      <EventCard
        event={makeEvent({ posterUrl })}
        setGoing={vi.fn()}
        setSaved={vi.fn()}
        attendanceResult={undefined}
        onConfirmAttendance={vi.fn()}
      />,
    );

    const thumbnail = container.querySelector("[style*='background-image']");
    expect(thumbnail).not.toBeNull();
    expect(thumbnail?.getAttribute("style")).toContain(posterUrl);
  });
});
