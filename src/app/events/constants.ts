// "I Was There" only makes sense while someone could plausibly still be at
// (or just leaving) the venue — a live GPS check can't confirm attendance
// at a show from last month. Shared between events/page.tsx's browse query
// and actions.ts's confirmAttendance mutation so the window that decides
// which events show the button matches the window the mutation enforces.
//
// Lives outside actions.ts because "use server" files may only export async
// functions — a plain constant export breaks the Next.js build.
export const ATTENDANCE_WINDOW_HOURS = 6;

// Fixed reason categories for reporting (docs/designdoc.md §9 Phase 4 item
// 6). Also outside actions.ts for the same "use server" export restriction
// as above.
export const REPORT_REASONS = ["spam", "wrong_info", "offensive", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
