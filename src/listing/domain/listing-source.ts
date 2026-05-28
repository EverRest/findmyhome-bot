/** Strip tracking / www prefixes until we reach site domain (e.g. clicks.immobiliare.it → immobiliare.it). */
export function baseDomainFromHost(hostname: string): string | null {
  let host = hostname.toLowerCase().replace(/\.$/, '');
  const stripLabels = new Set([
    'www',
    'clicks',
    'click',
    'track',
    'email',
    'm',
  ]);

  while (host.includes('.')) {
    const label = host.split('.')[0];
    if (!stripLabels.has(label)) break;
    host = host.slice(label.length + 1);
  }

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join('.');
}

/** Portal homepage derived from any listing or tracking URL. */
export function portalHomeFromUrl(url: string): string | null {
  try {
    const base = baseDomainFromHost(new URL(url).hostname);
    if (!base) return null;
    return `https://www.${base}`;
  } catch {
    return null;
  }
}

export function inferListingSource(
  source: string | null | undefined,
  listingUrl: string | null | undefined,
  canonicalUrl?: string,
): string | undefined {
  for (const url of [listingUrl, canonicalUrl]) {
    if (!url?.startsWith('http')) continue;
    const base = baseDomainFromHost(new URL(url).hostname);
    if (base) return base;
  }
  if (source?.includes('.')) {
    return source
      .replace(/^www\./, '')
      .toLowerCase()
      .trim();
  }
  return undefined;
}

export function portalHomeUrl(
  sourceKey: string | undefined,
  listingUrl?: string | null,
  canonicalUrl?: string | null,
): string | null {
  for (const url of [listingUrl, canonicalUrl]) {
    if (url?.startsWith('http')) {
      const home = portalHomeFromUrl(url);
      if (home) return home;
    }
  }
  if (sourceKey?.includes('.')) {
    return `https://www.${sourceKey.replace(/^www\./, '').toLowerCase()}`;
  }
  return null;
}

export function formatSourceLine(
  source: string | null | undefined,
  listingUrl?: string | null,
  canonicalUrl?: string,
): string | null {
  if (source === 'facebook.group') {
    const link = listingUrl ?? canonicalUrl;
    if (link?.includes('facebook.com')) {
      return `📌 Facebook · ${link}`;
    }
    return '📌 Facebook group';
  }

  const home = portalHomeUrl(
    inferListingSource(source, listingUrl, canonicalUrl),
    listingUrl,
    canonicalUrl,
  );
  if (!home) return null;
  return `📌 ${home}`;
}
