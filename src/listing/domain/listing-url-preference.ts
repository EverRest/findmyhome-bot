/** Prefer direct portal listing URLs over tracking / synthetic alert links. */
export function pickPreferredListingUrl(
  existing: string | null | undefined,
  incoming: string | undefined,
): string | undefined {
  const candidates = [incoming, existing].filter((u): u is string =>
    Boolean(u?.trim()),
  );
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => listingUrlScore(b) - listingUrlScore(a));
  return candidates[0];
}

export function pickBetterTitle(
  existing: string | null | undefined,
  incoming: string | undefined,
): string | undefined {
  const a = existing?.trim();
  const b = incoming?.trim();
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

export function listingUrlScore(url: string): number {
  if (/clicks\.immobiliare/i.test(url)) return 1;
  if (/immobiliare\.it\/annunci\/alert-/i.test(url)) return 2;
  if (/idealista\.it\/immobile\/\d+/i.test(url)) return 10;
  if (/casa\.it\/immobili\/\d+/i.test(url)) return 10;
  if (/immobiliare\.it\/annunci\/\d+/i.test(url)) return 8;
  if (url.startsWith('http')) return 5;
  return 0;
}
