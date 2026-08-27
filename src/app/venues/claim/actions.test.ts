import { afterEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table !== "venue_claims") throw new Error(`unexpected table: ${table}`);
      return { insert };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { submitVenueClaim } from "./actions";

function baseFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

describe("submitVenueClaim", () => {
  afterEach(() => {
    insert.mockReset();
    getUser.mockReset();
  });

  it("rejects an existing-venue claim with no venue picked, without inserting", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await submitVenueClaim(null, baseFormData({ mode: "existing" }));

    expect(result).toEqual({ error: "Pick a venue to claim." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("submits a claim against an existing venue", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockResolvedValue({ error: null });

    const result = await submitVenueClaim(
      null,
      baseFormData({ mode: "existing", venueId: "venue-1", note: "I run this space" })
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith({
      claimant_id: "user-1",
      venue_id: "venue-1",
      note: "I run this space",
    });
  });

  it("rejects a new-venue registration with no name", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await submitVenueClaim(
      null,
      baseFormData({ mode: "new", venueLat: "34.05", venueLng: "-118.24" })
    );

    expect(result).toEqual({ error: "Venue name is required." });
    expect(insert).not.toHaveBeenCalled();
  });

  // venues.lat/lng are NOT NULL, and approve_venue_claim inserts straight
  // from these fields (db/migrations/0006_venue_claims.sql) — a claim
  // missing a location must be rejected here, not left to fail opaquely at
  // approval time.
  it("rejects a new-venue registration with no location", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const result = await submitVenueClaim(
      null,
      baseFormData({ mode: "new", venueName: "The Basement" })
    );

    expect(result).toEqual({
      error: "Venue location is required — use current location or enter it by hand.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("submits a new-venue registration with a name and location", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockResolvedValue({ error: null });

    const result = await submitVenueClaim(
      null,
      baseFormData({
        mode: "new",
        venueName: "The Basement",
        venueAddress: "123 Main St",
        venueLat: "34.05",
        venueLng: "-118.24",
      })
    );

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith({
      claimant_id: "user-1",
      venue_name: "The Basement",
      venue_address: "123 Main St",
      venue_lat: 34.05,
      venue_lng: -118.24,
      note: null,
    });
  });
});
