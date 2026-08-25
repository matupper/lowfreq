export type EventWithVenue = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  displayTime: string;
  venue: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
  goingCount: number;
  myGoing: boolean;
  mySaved: boolean;
  // "YYYY-MM-DD" in the scene's display time zone (see dateKeyInZone in
  // src/lib/dateGrouping.ts) — used to bucket the shows list by calendar
  // day ("TONIGHT" first, then a header per subsequent date).
  dateKey: string;
  // Whether `startTime` is already in the past, computed server-side (see
  // events/page.tsx) rather than recomputed client-side, so it can't
  // disagree with the server's clock or flip mid-render.
  hasStarted: boolean;
  // Set once "I Was There" has been confirmed for this user/event — see
  // the `attendance` table (docs/designdoc.md §6.1), kept independent of
  // going/saved.
  attendedAt: string | null;
};
