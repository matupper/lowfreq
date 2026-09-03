import { afterEach, describe, expect, it, vi } from "vitest";

const { rpc, getUser, confirmAttendance } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  confirmAttendance: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

vi.mock("@/app/events/actions", () => ({
  confirmAttendance,
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { confirmCheckinAttendance } from "./actions";

describe("confirmCheckinAttendance", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    confirmAttendance.mockReset();
  });

  it("redirects to /login with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(confirmCheckinAttendance("TOKEN1")).rejects.toThrow("REDIRECT:/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns invalid when redeem_invite finds nothing (expired/revoked/unknown token)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValueOnce({ data: [] }); // redeem_invite

    const result = await confirmCheckinAttendance("TOKEN1");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(confirmAttendance).not.toHaveBeenCalled();
  });

  it("returns invalid when the token isn't a reusable venue code", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc
      .mockResolvedValueOnce({ data: [{ invite_id: "invite-1" }] }) // redeem_invite
      .mockResolvedValueOnce({ data: [{ event_id: null, venue_id: null, reusable: false }] }); // invite_checkin_info

    const result = await confirmCheckinAttendance("TOKEN1");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(confirmAttendance).not.toHaveBeenCalled();
  });

  it("confirms attendance with method venue_qr and no GPS reading for a valid reusable code", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc
      .mockResolvedValueOnce({ data: [{ invite_id: "invite-1" }] }) // redeem_invite
      .mockResolvedValueOnce({
        data: [{ event_id: "event-1", venue_id: "venue-1", reusable: true }],
      }); // invite_checkin_info
    confirmAttendance.mockResolvedValue({ ok: true });

    const result = await confirmCheckinAttendance("token1");

    expect(result).toEqual({ ok: true });
    expect(confirmAttendance).toHaveBeenCalledWith("event-1", null, "venue_qr");
    expect(rpc).toHaveBeenCalledWith("redeem_invite", { invite_token: "TOKEN1" });
    expect(rpc).toHaveBeenCalledWith("invite_checkin_info", { invite_token: "TOKEN1" });
  });
});
