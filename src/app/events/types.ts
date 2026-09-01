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
  // Host-uploaded poster (docs/designdoc.md §9 Phase 4 item 3) — null keeps
  // today's generated flyer-card treatment. See EventCard.tsx.
  posterUrl: string | null;
};

// A submitter's own event, shown on their profile's "your submissions"
// section — deliberately separate from EventWithVenue rather than adding a
// status field there (see docs/designdoc.md §9 Phase 4 item 1's plan
// reference): the main feed type has no use for status once it's always
// filtered to 'approved', and a host's pending/rejected row never needs
// venue/RSVP/attendance metadata the way a feed card does.
export type SubmittedEvent = {
  id: string;
  title: string;
  startTime: string;
  status: "pending" | "rejected";
};
