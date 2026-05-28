import { ListingDraft } from './listing-draft';

export type ListingFingerprintFields = Pick<
  ListingDraft,
  'title' | 'locationHint' | 'rawSnippet' | 'rentEur' | 'rooms' | 'areaSqm'
>;

/** Cross-portal dedup key: normalized street + rent + rooms + area. */
export function computeListingFingerprint(
  draft: ListingFingerprintFields,
): string | null {
  const rent = draft.rentEur;
  if (rent == null || rent < 100) return null;

  const blob = `${draft.locationHint ?? ''} ${draft.title ?? ''} ${
    draft.rawSnippet ?? ''
  }`;
  const street = normalizeStreetKey(blob);
  const rooms = draft.rooms != null ? String(Math.round(draft.rooms)) : null;
  const area = draft.areaSqm != null ? String(Math.round(draft.areaSqm)) : null;

  if (!street) return null;

  return `${street}|r${rooms ?? '?'}|a${area ?? '?'}|€${rent}`;
}

export function normalizeStreetKey(text: string): string | null {
  const blob = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const viaMatch = blob.match(
    /\b(?:via|corso|largo|piazza|vicolo|strada|str\.?)\s+([a-z0-9]+)(?:\s+(\d+[a-z]?))?/i,
  );
  if (viaMatch) {
    const name = viaMatch[1];
    const num = viaMatch[2] ?? '';
    return num ? `via-${name}-${num}` : `via-${name}`;
  }

  const inlineVia = blob.match(
    /\b(?:flat|appartamento|bilocale|trilocale|monolocale|villetta)\s+(?:in\s+)?via\s+([a-z0-9]+)\s+(\d+[a-z]?)/i,
  );
  if (inlineVia) {
    return `via-${inlineVia[1]}-${inlineVia[2]}`;
  }

  const commaStreet = blob.match(/\bvia\s+([a-z0-9]+)\s*,\s*(\d+[a-z]?)\b/i);
  if (commaStreet) {
    return `via-${commaStreet[1]}-${commaStreet[2]}`;
  }

  return null;
}
