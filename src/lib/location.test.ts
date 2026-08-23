import { describe, expect, it } from "vitest";
import { checkProximity, DEFAULT_RECENCY_WINDOW_MS, haversineDistanceMeters } from "./location";

describe("haversineDistanceMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceMeters({ lat: 40.7128, lng: -74.006 }, { lat: 40.7128, lng: -74.006 })).toBe(0);
  });

  it("matches a known real-world distance within a small tolerance", () => {
    // Los Angeles City Hall -> Hollywood Bowl, ~11km as the crow flies.
    const cityHall = { lat: 34.0537, lng: -118.2428 };
    const hollywoodBowl = { lat: 34.1122, lng: -118.3391 };
    const distance = haversineDistanceMeters(cityHall, hollywoodBowl);
    expect(distance).toBeGreaterThan(10500);
    expect(distance).toBeLessThan(11500);
  });
});

describe("checkProximity", () => {
  const venue = { lat: 34.0537, lng: -118.2428 };
  const now = 1_700_000_000_000;

  it("passes for a fresh reading right at the target", () => {
    const result = checkProximity({ ...venue, accuracy: 10, timestamp: now }, venue, { now });
    expect(result.ok).toBe(true);
  });

  it("fails as too_far when the reading is outside the radius", () => {
    const farAway = { lat: 34.1122, lng: -118.3391 };
    const result = checkProximity(
      { ...farAway, accuracy: 10, timestamp: now },
      venue,
      { now }
    );
    expect(result).toEqual({ ok: false, reason: "too_far", distanceMeters: expect.any(Number) });
  });

  it("fails as stale when the reading is older than the recency window", () => {
    const staleTimestamp = now - DEFAULT_RECENCY_WINDOW_MS - 1;
    const result = checkProximity(
      { ...venue, accuracy: 10, timestamp: staleTimestamp },
      venue,
      { now }
    );
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("respects a custom radius", () => {
    // ~111m north of the venue.
    const nearby = { lat: venue.lat + 0.001, lng: venue.lng };
    const tight = checkProximity({ ...nearby, accuracy: 10, timestamp: now }, venue, {
      now,
      radiusMeters: 50,
    });
    expect(tight.ok).toBe(false);

    const loose = checkProximity({ ...nearby, accuracy: 10, timestamp: now }, venue, {
      now,
      radiusMeters: 500,
    });
    expect(loose.ok).toBe(true);
  });
});
