import { afterEach, describe, expect, it, vi } from "vitest";

// approve_event/reject_event enforce is_admin internally (db/schema.sql) —
// these wrappers are not a second authorization layer, but they must still
// send the right RPC call and redirect an unauthenticated caller rather
// than silently no-op-ing through to the RPC.
const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
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

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { approveEvent, rejectEvent } from "./actions";

describe("approveEvent", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    vi.mocked(redirect).mockClear();
    vi.mocked(revalidatePath).mockClear();
  });

  it("redirects to /login instead of calling the RPC when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(approveEvent("event-1")).rejects.toThrow(
      "redirect() should not be reached in this test"
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls approve_event and revalidates both the admin queue and the public feed", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ error: null });

    await approveEvent("event-1");

    expect(rpc).toHaveBeenCalledWith("approve_event", { target_event_id: "event-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/home");
  });

  it("propagates an RPC error (e.g. a non-admin caller rejected server-side) instead of swallowing it", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "not-admin" } } });
    rpc.mockResolvedValue({ error: { message: "permission denied" } });

    await expect(approveEvent("event-1")).rejects.toEqual({ message: "permission denied" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rejectEvent", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    vi.mocked(redirect).mockClear();
    vi.mocked(revalidatePath).mockClear();
  });

  it("redirects to /login instead of calling the RPC when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(rejectEvent("event-1")).rejects.toThrow(
      "redirect() should not be reached in this test"
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls reject_event and revalidates only the admin queue", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ error: null });

    await rejectEvent("event-1");

    expect(rpc).toHaveBeenCalledWith("reject_event", { target_event_id: "event-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).not.toHaveBeenCalledWith("/home");
  });
});
