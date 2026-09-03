import { afterEach, describe, expect, it, vi } from "vitest";

// A live GPS check can't confirm attendance at a show from last month —
// confirmAttendance rejects events that started more than
// ATTENDANCE_WINDOW_HOURS ago as "too_late" rather than letting a stale
// event fall through to a proximity check. This exercises the real server
// action's date-window logic end to end (not just the UI's message map).
const maybeSingle = vi.fn();
const upsert = vi.fn();
const insert = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
      upsert,
      insert,
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

import { confirmAttendance, fileReport } from "./actions";
import { ATTENDANCE_WINDOW_HOURS } from "./constants";

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

// method: "venue_qr" (Phase 4) is the GPS-independent fork used by
// /checkin/[token] — the whole point is confirming attendance with no
// reading at all, which the "gps" method would reject as no_location.
// Still subject to the same start-time/attendance-window checks as gps.
describe("confirmAttendance venue_qr method", () => {
  afterEach(() => {
    maybeSingle.mockReset();
    upsert.mockReset();
    getUser.mockReset();
  });

  it("confirms attendance with no GPS reading at all", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const justInside = new Date(Date.now() - (ATTENDANCE_WINDOW_HOURS - 1) * 60 * 60 * 1000);
    maybeSingle.mockResolvedValue({
      data: { start_time: justInside.toISOString(), venue: null },
    });
    upsert.mockResolvedValue({ error: null });

    const result = await confirmAttendance("event-1", null, "venue_qr");

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", event_id: "event-1", method: "venue_qr" },
      { onConflict: "user_id,event_id", ignoreDuplicates: true }
    );
  });

  it("still rejects as too_late for a stale event, same as the gps method", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const longAgo = new Date(Date.now() - (ATTENDANCE_WINDOW_HOURS + 1) * 60 * 60 * 1000);
    maybeSingle.mockResolvedValue({
      data: { start_time: longAgo.toISOString(), venue: null },
    });

    const result = await confirmAttendance("event-1", null, "venue_qr");

    expect(result).toEqual({ ok: false, reason: "too_late" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

// reports.target_id has no FK (db/migrations/0011_reports.sql) — integrity
// is an app-layer check at insert time, so fileReport confirms the event
// actually exists before ever attempting the insert.
describe("fileReport", () => {
  afterEach(() => {
    maybeSingle.mockReset();
    insert.mockReset();
    getUser.mockReset();
  });

  it("rejects an unrecognized reason category without touching the database", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    // @ts-expect-error deliberately passing an invalid category
    const result = await fileReport("event-1", "made_up_category", "");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns not_found instead of inserting when the target event doesn't exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: null });

    const result = await fileReport("event-1", "spam", "");

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("folds optional free text into the reason column alongside the category", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: { id: "event-1" } });
    insert.mockResolvedValue({ error: null });

    const result = await fileReport("event-1", "offensive", "  gross flyer art  ");

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({
      reporter_id: "user-1",
      target_type: "event",
      target_id: "event-1",
      reason: "offensive: gross flyer art",
    });
  });

  it("stores just the category when no free text is given", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: { id: "event-1" } });
    insert.mockResolvedValue({ error: null });

    await fileReport("event-1", "spam", "");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "spam" })
    );
  });
});
