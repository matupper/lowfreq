import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
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

import { approveVenueClaim, rejectVenueClaim } from "./actions";

describe("approveVenueClaim", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });

  it("redirects to /admin?error=approve_failed when the RPC reports failure", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ data: false });

    await expect(approveVenueClaim("claim-1")).rejects.toThrow(
      "REDIRECT:/admin?error=approve_failed"
    );
    expect(rpc).toHaveBeenCalledWith("approve_venue_claim", { claim_id: "claim-1" });
  });

  it("does not redirect on error when the RPC reports success", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ data: true });

    await expect(approveVenueClaim("claim-1")).resolves.toBeUndefined();
  });
});

describe("rejectVenueClaim", () => {
  afterEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });

  it("redirects to /admin?error=reject_failed when the RPC reports failure", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ data: false });

    await expect(rejectVenueClaim("claim-1")).rejects.toThrow(
      "REDIRECT:/admin?error=reject_failed"
    );
    expect(rpc).toHaveBeenCalledWith("reject_venue_claim", { claim_id: "claim-1" });
  });

  it("does not redirect on error when the RPC reports success", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    rpc.mockResolvedValue({ data: true });

    await expect(rejectVenueClaim("claim-1")).resolves.toBeUndefined();
  });
});
