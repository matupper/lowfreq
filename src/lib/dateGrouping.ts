// Groups the shows list by calendar day (CLAUDE.md's "Landing page" section
// — "TONIGHT" first, then a header per subsequent date). Both helpers are
// pure so the server can compute the scene-timezone-correct key once and
// hand it to the client without either side needing to re-resolve a time
// zone.

// "YYYY-MM-DD" for a moment in a given IANA time zone — used both to group
// events into same-day buckets and, compared against today's key, to decide
// whether a bucket's header should read "TONIGHT" or a weekday/date.
export function dateKeyInZone(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which also sorts/compares lexicographically.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "Wednesday, 8/26" — weekday plus short numeric date, for a group's section
// header once it isn't today (today's group uses "TONIGHT" instead — see
// callers of dateKeyInZone). Parses the key as UTC midnight since the key
// already encodes the scene's local calendar day; applying a time zone
// again here would risk shifting that day for zones behind UTC.
export function formatDateGroupHeader(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date);
  const shortDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(date);
  return `${weekday}, ${shortDate}`;
}
