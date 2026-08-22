import { describe, expect, it } from "vitest";
import {
  formatInviteToken,
  generateInviteToken,
  inviteJoinUrl,
  normalizeInviteToken,
} from "./invites";

describe("generateInviteToken", () => {
  it("produces an 8-character code using only unambiguous characters", () => {
    // Ambiguous characters (0/O, 1/I/L) are excluded because this code
    // doubles as the human-typable manual-entry fallback.
    for (let i = 0; i < 200; i++) {
      const token = generateInviteToken();
      expect(token).toHaveLength(8);
      expect(token).toMatch(/^[A-Z2-9]+$/);
      expect(token).not.toMatch(/[01OIL]/);
    }
  });

  it("varies between calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));
    expect(tokens.size).toBeGreaterThan(1);
  });
});

describe("formatInviteToken", () => {
  it("groups an 8-character token into two dash-separated halves", () => {
    expect(formatInviteToken("K7RX9QPL")).toBe("K7RX-9QPL");
  });
});

describe("normalizeInviteToken", () => {
  it("strips separators and uppercases lowercase manual entry", () => {
    expect(normalizeInviteToken("k7rx-9qpl")).toBe("K7RX9QPL");
  });

  it("strips whitespace and other stray punctuation", () => {
    expect(normalizeInviteToken(" k7rx 9qpl!")).toBe("K7RX9QPL");
  });

  it("passes already-normalized tokens through unchanged", () => {
    expect(normalizeInviteToken("K7RX9QPL")).toBe("K7RX9QPL");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeInviteToken("")).toBe("");
  });
});

describe("inviteJoinUrl", () => {
  it("builds a /signup deep link carrying the raw token as a query param", () => {
    expect(inviteJoinUrl("https://lowfreq.app", "K7RX9QPL")).toBe(
      "https://lowfreq.app/signup?token=K7RX9QPL"
    );
  });
});
