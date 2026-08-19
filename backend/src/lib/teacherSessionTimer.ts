/** Strict 2-hour teacher class session timer policy. */

export const REQUIRED_CLASS_MINUTES = 120;

/** Approximate Dhapti Main Campus — used for optional geofence. */
export const BIU_CAMPUS = {
  lat: Number(process.env.BIU_CAMPUS_LAT ?? 3.11383),
  lng: Number(process.env.BIU_CAMPUS_LNG ?? 43.6498),
  radiusMeters: Number(process.env.BIU_CAMPUS_RADIUS_M ?? 3000),
} as const;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(start: Date, end: Date): number {
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / 60_000);
}

export function remainingMs(checkIn: Date, requiredMinutes = REQUIRED_CLASS_MINUTES, now = new Date()): number {
  const expected = addMinutes(checkIn, requiredMinutes);
  return Math.max(0, expected.getTime() - now.getTime());
}

export function isEarlyExit(
  checkIn: Date,
  checkOut: Date,
  requiredMinutes = REQUIRED_CLASS_MINUTES
): boolean {
  return minutesBetween(checkIn, checkOut) < requiredMinutes;
}

export function resolveTimerStatus(
  checkIn: Date,
  checkOut: Date,
  requiredMinutes = REQUIRED_CLASS_MINUTES
): "COMPLETED" | "EARLY_EXIT" {
  return isEarlyExit(checkIn, checkOut, requiredMinutes)
    ? "EARLY_EXIT"
    : "COMPLETED";
}

/** Haversine distance in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function verifyCampusLocation(
  lat: number | null | undefined,
  lng: number | null | undefined
): { verified: boolean; distanceMeters: number | null; required: boolean } {
  const required = String(process.env.BIU_REQUIRE_CAMPUS_LOCATION ?? "").toLowerCase() === "true";
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { verified: false, distanceMeters: null, required };
  }
  const d = distanceMeters(lat, lng, BIU_CAMPUS.lat, BIU_CAMPUS.lng);
  return {
    verified: d <= BIU_CAMPUS.radiusMeters,
    distanceMeters: Math.round(d),
    required,
  };
}

export function formatCountdown(ms: number): {
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hours,
    minutes,
    seconds,
    label: `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`,
  };
}
