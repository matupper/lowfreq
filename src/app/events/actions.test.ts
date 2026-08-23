import { afterEach, describe, expect, it, vi } from "vitest";

// A live GPS check can't confirm attendance at a show from last month —
// confirmAttendance rejects events that started more than
// ATTENDANCE_WINDOW_HOURS ago as "too_late" rather than letting a stale
// event fall through to a proximity check. This exercises the real server
// action's date-window logic end to end (not just the UI's message map).
const maybeSingle = vi.fn();
const upsert = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
      upsert,
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() should not be reached in this test");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { confirmAttendance, ATTENDANCE_WINDOW_HOURS } from "./actions";

const reading = { lat: 34.0537, lng: -118.2428, accuracy: 5, timestamp: Date.now() };

describe("confirmAttendance recency bound", () => {
  afterEach(() => {
    maybeSingle.mockReset();
    upsert.mockReset();
    getUser.mockReset();
  });

  it("rejects as too_late for an event that started well before the attendance window", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const longAgo = new Date(Date.now() - (ATTENDANCE_WINDOW_HOURS + 1) * 60 * 60 * 1000);
    maybeSingle.mockResolvedValue({
      data: { start_time: longAgo.toISOString(), venue: { lat: 34.0537, lng: -118.2428 } },
    });

    const result = await confirmAttendance("event-1", reading);

    expect(result).toEqual({ ok: false, reason: "too_late" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("still allows confirmation for an event that started just inside the attendance window", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const justInside = new Date(Date.now() - (ATTENDANCE_WINDOW_HOURS - 1) * 60 * 60 * 1000);
    maybeSingle.mockResolvedValue({
      data: { start_time: justInside.toISOString(), venue: { lat: 34.0537, lng: -118.2428 } },
    });
    upsert.mockResolvedValue({ error: null });

    const result = await confirmAttendance("event-1", reading);

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
  });
});
