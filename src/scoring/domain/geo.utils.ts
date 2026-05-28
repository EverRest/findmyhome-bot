export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceBucket {
  maxM: number;
  score: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters (Haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceToScore(
  meters: number,
  buckets: DistanceBucket[],
  missingScore = 5,
): number {
  if (!Number.isFinite(meters) || meters < 0) return missingScore;
  const sorted = [...buckets].sort((a, b) => a.maxM - b.maxM);
  for (const bucket of sorted) {
    if (meters <= bucket.maxM) return bucket.score;
  }
  return 0;
}

export function normalizeGeocodeKey(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGeocodeQuery(
  locationHint: string | null | undefined,
  title: string | null | undefined,
  citySuffix?: string,
): string | null {
  const raw = (locationHint?.trim() || title?.trim() || '').replace(
    /\s+/g,
    ' ',
  );
  if (!raw || raw.length < 5) return null;

  const suffix = citySuffix?.trim();
  if (!suffix) return raw;

  const lower = raw.toLowerCase();
  if (lower.includes('torino') || lower.includes('turin')) {
    return raw;
  }
  return `${raw}, ${suffix}`;
}

export function formatDistanceM(meters: number): string {
  if (meters < 1000) return `~${Math.round(meters)} m`;
  return `~${(meters / 1000).toFixed(1)} km`;
}
