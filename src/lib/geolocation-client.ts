import type { GeoReading } from "./location";

// Browser-only wrapper around the callback-based Geolocation API. This is
// deliberately dumb — it only reads a position and normalizes the failure
// modes a caller needs to branch on. It never judges whether the reading is
// "close enough": that's the shared proximity check in ./location, run
// server-side against data the client can't fake its way past.
export type LocationResult =
  | { status: "ok"; reading: GeoReading }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "timeout" };

export function getCurrentLocation(options?: PositionOptions): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unavailable" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "ok",
          reading: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          },
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: "denied" });
        } else if (error.code === error.TIMEOUT) {
          resolve({ status: "timeout" });
        } else {
          resolve({ status: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options }
    );
  });
}
