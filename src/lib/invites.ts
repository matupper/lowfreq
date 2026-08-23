import { randomInt } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) so a code read off a
// screen and typed back in manually is unlikely to be misread.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

// docs/designdoc.md §9 Phase 3 / §3's Phase 2 table suggestion ("e.g. 5
// minutes"). Short enough that a scan-time GPS check (comparing the
// invitee's position to wherever the inviter was when they generated this)
// still means something — long enough that walking across a venue to hand
// someone your phone doesn't race the clock.
export const INVITE_EXPIRY_MINUTES = 5;

export function inviteExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + INVITE_EXPIRY_MINUTES * 60 * 1000).toISOString();
}

// Raw token stored in invites.token and encoded in the QR — no separators.
export function generateInviteToken(): string {
  let token = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    token += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return token;
}

// Same token, grouped for display/manual entry: "K7RX9QPL" -> "K7RX-9QPL".
export function formatInviteToken(token: string): string {
  return `${token.slice(0, 4)}-${token.slice(4)}`;
}

// Manual entry accepts the formatted or unformatted form, any case.
export function normalizeInviteToken(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function inviteJoinUrl(origin: string, token: string): string {
  return `${origin}/signup?token=${token}`;
}

export type InviteStatus = "unused" | "used" | "expired" | "revoked";

// The invites.status column only flips to 'expired' lazily, the next time
// something tries to redeem or look up a past-due token (see
// db/migrations/0003 — a stable peek function has nowhere to write a side
// effect). Display code should compute the effective status instead of
// trusting a stale 'unused' row.
export function effectiveInviteStatus(
  status: string,
  expiresAt: string | null
): InviteStatus {
  if (status === "unused" && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return status as InviteStatus;
}
