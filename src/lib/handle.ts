// Handle format: 3-20 chars, letters/numbers/underscore only. Case is
// preserved for display (e.g. "DJ_Rust" renders as typed) — uniqueness is
// enforced case-insensitively at the database level (a unique index on
// lower(handle), see db/migrations/0005_profile_fields.sql), matching the
// common handle convention where "@Name" and "@name" are the same account.
const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;
export const HANDLE_FORMAT_HINT =
  "3-20 characters, letters, numbers, underscore only";

// Strips a leading "@" (people type handles with it out of habit) and
// surrounding whitespace. Does not lowercase — see the case-preservation
// note above.
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "");
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}
