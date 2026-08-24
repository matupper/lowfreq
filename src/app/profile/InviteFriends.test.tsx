import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const revokeInvite = vi.fn();
vi.mock("./invite/actions", () => ({
  revokeInvite: (...args: unknown[]) => revokeInvite(...args),
}));

import { InvitedByCard, InviteeList, type Inviter, type InviteTreeRow } from "./InviteFriends";

afterEach(() => cleanup());

describe("InvitedByCard", () => {
  it("renders nothing for a user with no inviter (e.g. a seed account)", () => {
    const { container } = render(<InvitedByCard inviter={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("highlights the inviter as a distinguished 'invited by' card, not a plain row", () => {
    const inviter: Inviter = {
      inviter_id: "u1",
      inviter_name: "Riot Grrrl",
      joined_at: "2026-01-15T00:00:00Z",
    };
    render(<InvitedByCard inviter={inviter} />);

    expect(screen.getByTestId("invited-by-card")).toBeTruthy();
    expect(screen.getByText(/invited by/i)).toBeTruthy();
    expect(screen.getByText("Riot Grrrl")).toBeTruthy();
  });
});

describe("InviteeList", () => {
  it("shows an empty-state message when nothing has been invited yet", () => {
    render(<InviteeList tree={[]} />);
    expect(screen.getByText(/haven.t invited anyone yet/i)).toBeTruthy();
  });

  it("shows join status for an invite that's been redeemed", () => {
    const tree: InviteTreeRow[] = [
      {
        invite_id: "i1",
        token: "ABCD1234",
        status: "used",
        expires_at: null,
        created_at: "2026-01-01T00:00:00Z",
        invitee_id: "u2",
        invitee_name: "Basement Show Bob",
        invitee_joined_at: "2026-01-02T00:00:00Z",
      },
    ];
    render(<InviteeList tree={tree} />);

    expect(screen.getByText("Basement Show Bob")).toBeTruthy();
    expect(screen.getByText("joined")).toBeTruthy();
  });

  it("shows an unredeemed invite's token, status, and a revoke action", () => {
    const tree: InviteTreeRow[] = [
      {
        invite_id: "i2",
        token: "WXYZ5678",
        status: "unused",
        expires_at: null,
        created_at: "2026-01-01T00:00:00Z",
        invitee_id: null,
        invitee_name: null,
        invitee_joined_at: null,
      },
    ];
    render(<InviteeList tree={tree} />);

    expect(screen.getByText("WXYZ-5678")).toBeTruthy();
    expect(screen.getByText(/not redeemed yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeTruthy();
  });

  it("shows an expired invite's effective status instead of a stale 'unused' state", () => {
    const tree: InviteTreeRow[] = [
      {
        invite_id: "i3",
        token: "EXPR0000",
        status: "unused",
        expires_at: "2020-01-01T00:00:00Z",
        created_at: "2020-01-01T00:00:00Z",
        invitee_id: null,
        invitee_name: null,
        invitee_joined_at: null,
      },
    ];
    render(<InviteeList tree={tree} />);

    expect(screen.getByText("expired")).toBeTruthy();
    expect(screen.queryByText(/not redeemed yet/i)).toBeNull();
  });
});
