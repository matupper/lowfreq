// The shared "is this device physically near this point right now"
// capability called out in docs/designdoc.md §6.1 — both location-verified
// invite scanning and "I Was There" attendance confirmation build on this
// rather than each rolling their own distance/recency math.
//
// Pure and framework-free on purpose: it runs equally well in a server
// action (verifying a claim) or a client component (previewing one), and
// is trivial to unit test without mocking the browser Geolocation API.

export type Coordinates = { lat: number; lng: number };

// A single GPS reading. `timestamp` is the device's own clock at capture
// time (from the Geolocation API), not server receipt time — using the
// server's receipt time would penalize a reading that's genuinely fresh
// but arrived after a slow network round trip.
export type GeoReading = Coordinates & {
  accuracy: number;
  timestamp: number;
};

const EARTH_RADIUS_METERS = 6371000;

// Great-circle distance between two points, in meters.
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Generous enough to absorb ordinary GPS drift (a big venue, a parking lot
// across the street) without being so wide it stops meaning anything.
export const DEFAULT_PROXIMITY_RADIUS_METERS = 200;

// How old a GPS reading is allowed to be by the time it's checked. Guards
// against a cached/stale device location (e.g. one captured before the
// user opened the app) being used to satisfy a "right now" check.
export const DEFAULT_RECENCY_WINDOW_MS = 5 * 60 * 1000;

export type ProximityResult =
  | { ok: true; distanceMeters: number }
  | { ok: false; reason: "too_far"; distanceMeters: number }
  | { ok: false; reason: "stale" };

export function checkProximity(
  reading: GeoReading,
  target: Coordinates,
  options: {
    radiusMeters?: number;
    recencyWindowMs?: number;
    now?: number;
  } = {}
): ProximityResult {
  const {
    radiusMeters = DEFAULT_PROXIMITY_RADIUS_METERS,
    recencyWindowMs = DEFAULT_RECENCY_WINDOW_MS,
    now = Date.now(),
  } = options;

  if (now - reading.timestamp > recencyWindowMs) {
    return { ok: false, reason: "stale" };
  }

  const distanceMeters = haversineDistanceMeters(reading, target);
  if (distanceMeters > radiusMeters) {
    return { ok: false, reason: "too_far", distanceMeters };
  }

  return { ok: true, distanceMeters };
}
