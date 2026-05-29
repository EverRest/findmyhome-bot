import {
  ListingFingerprintFields,
  normalizeStreetKey,
} from './listing-fingerprint';

/** Soft dedup key: normalized street + rooms + rent (no area). */
export function computePropertyMatchKey(
  draft: ListingFingerprintFields,
): string | null {
  const rent = draft.rentEur;
  if (rent == null || rent < 100) return null;

  const blob = `${draft.locationHint ?? ''} ${draft.title ?? ''} ${
    draft.rawSnippet ?? ''
  }`;
  const street = normalizeStreetKey(blob);
  if (!street) return null;

  const rooms = draft.rooms != null ? String(Math.round(draft.rooms)) : '?';
  return `${street}|r${rooms}|€${rent}`;
}
