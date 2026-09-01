import { afterEach, describe, expect, it, vi } from "vitest";

const eventsMaybeSingle = vi.fn();
const invitesSelectMaybeSingle = vi.fn();
const invitesInsertSingle = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "events") {
        return { select: () => ({ eq: () => ({ maybeSingle: eventsMaybeSingle }) }) };
      }
      if (table === "invites") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: invitesSelectMaybeSingle }) }),
          }),
          insert: () => ({
            select: () => ({ single: invitesInsertSingle }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
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

import { getOrCreateCheckinCode } from "./actions";

const ownedEvent = {
  id: "event-1",
  start_time: "2026-03-01T20:00:00.000Z",
  venue_id: "venue-1",
  venue: { owner_id: "owner-1" },
};

describe("getOrCreateCheckinCode", () => {
  afterEach(() => {
    eventsMaybeSingle.mockReset();
    invitesSelectMaybeSingle.mockReset();
    invitesInsertSingle.mockReset();
    getUser.mockReset();
  });

  it("refuses an event whose venue the caller doesn't own", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "not-the-owner" } } });
    eventsMaybeSingle.mockResolvedValue({ data: ownedEvent });

    await expect(getOrCreateCheckinCode("event-1")).rejects.toThrow(
      "You don't own this event's venue."
    );
    expect(invitesSelectMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns an existing reusable code instead of creating a second one", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    eventsMaybeSingle.mockResolvedValue({ data: ownedEvent });
    invitesSelectMaybeSingle.mockResolvedValue({ data: { token: "EXIST123" } });

    const token = await getOrCreateCheckinCode("event-1");

    expect(token).toBe("EXIST123");
    expect(invitesInsertSingle).not.toHaveBeenCalled();
  });

  it("creates a new reusable code tied to the event/venue when none exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    eventsMaybeSingle.mockResolvedValue({ data: ownedEvent });
    invitesSelectMaybeSingle.mockResolvedValue({ data: null });
    invitesInsertSingle.mockResolvedValue({ data: { token: "NEWTOKEN" }, error: null });

    const token = await getOrCreateCheckinCode("event-1");

    expect(token).toBe("NEWTOKEN");
  });

  it("falls back to the winning row on a double-click race (23505)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    eventsMaybeSingle.mockResolvedValue({ data: ownedEvent });
    invitesSelectMaybeSingle
      .mockResolvedValueOnce({ data: null }) // no existing code yet
      .mockResolvedValueOnce({ data: { token: "WINNER99" } }); // lost the race
    invitesInsertSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    const token = await getOrCreateCheckinCode("event-1");

    expect(token).toBe("WINNER99");
  });
});
