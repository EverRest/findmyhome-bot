const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

export function canonicalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    UTM_PARAMS.forEach((p) => url.searchParams.delete(p));
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Immobiliare alerts: "€ 1.000/month" often misparsed as 1€ → treat as 1000€. */
export function normalizeImmobiliareRent(
  n: number | undefined,
  text: string,
): number | undefined {
  if (/€\s*1[.,\s]?000\b/i.test(text) || /€\s*1\.000/i.test(text)) {
    return 1000;
  }
  if (n === 1) {
    return 1000;
  }
  return n;
}

function acceptRent(n: number | undefined, text: string): number | undefined {
  const normalized = normalizeImmobiliareRent(n, text);
  if (normalized == null) return undefined;
  const monthly = /(?:\/\s*)?(?:month|mese|mo\b)|\/mese|al mese/i.test(text);
  if (normalized > 1_500 && !monthly) {
    return undefined;
  }
  if (normalized >= 150 && normalized <= 15_000) return normalized;
  return undefined;
}

/** Monthly rent from alert text (Immobiliare: "€ 750/month"). */
export function extractEur(text: string): number | undefined {
  const monthly = text.match(
    /€\s*([\d][\d.,\s]*)\s*(?:\/\s*)?(?:month|mese|mo\b)/i,
  );
  if (monthly) {
    const accepted = acceptRent(parseEuropeanAmount(monthly[1]), text);
    if (accepted != null) return accepted;
  }

  const afterSymbol = text.match(/€\s*([\d][\d.,\s]*)/i);
  if (afterSymbol) {
    const end = (afterSymbol.index ?? 0) + afterSymbol[0].length;
    const tail = text.slice(end, end + 8);
    if (!/^\s*m[²2]/i.test(tail)) {
      const accepted = acceptRent(parseEuropeanAmount(afterSymbol[1]), text);
      if (accepted != null) return accepted;
    }
  }

  const beforeSymbol = text.match(/([\d][\d.,\s]*)\s*€/i);
  if (!beforeSymbol) return undefined;
  return acceptRent(parseEuropeanAmount(beforeSymbol[1]), text);
}

/** "1.200" (IT thousands) → 1200; "1,200" → 1200; avoids "| 1 bathroom" false positives. */
export function parseEuropeanAmount(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  let normalized = s.replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    const parts = normalized.split(',');
    normalized =
      parts.length === 2 && parts[1].length === 3
        ? parts[0] + parts[1]
        : normalized.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }

  const n = Math.round(parseFloat(normalized));
  if (!Number.isFinite(n)) return undefined;
  if (n === 1 && /^1\.0+$/.test(normalized.replace(/\s/g, ''))) {
    return 1000;
  }
  return n;
}

export function extractSqm(text: string): number | undefined {
  const m = text.match(/(\d+)\s*m(?:q|²|2)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

export function extractRooms(text: string): number | undefined {
  const roomsEn = text.match(/(\d+)\s*rooms?\b/i);
  if (roomsEn) return parseInt(roomsEn[1], 10);
  const stanze = text.match(/(\d+)\s*stanze\b/i);
  if (stanze) return parseInt(stanze[1], 10);
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:locali|loc\.?|camere)/i);
  if (!m) return undefined;
  return parseFloat(m[1].replace(',', '.'));
}

/** Idealista titles: "Trilocale in Via …" */
export function extractRoomsFromItalianTitle(
  title: string,
): number | undefined {
  const t = title.toLowerCase();
  if (/\bmonolocale\b/.test(t)) return 1;
  if (/\bbilocale\b/.test(t)) return 2;
  if (/\btrilocale\b/.test(t)) return 3;
  if (/\bquadrilocale\b/.test(t)) return 4;
  return undefined;
}

export function extractCondoFee(text: string): number | undefined {
  const m = text.match(/(?:spese|condominio)[^\d]*(\d+)/i);
  return m ? parseInt(m[1], 10) : undefined;
}
