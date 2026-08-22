import { randomInt } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) so a code read off a
// screen and typed back in manually is unlikely to be misread.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

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
