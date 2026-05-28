import { extractEur, extractRooms, extractSqm } from './url.utils';

export function isCasaAlertEmail(fromAddress: string): boolean {
  return fromAddress.toLowerCase().includes('casa.it');
}

export function isGenericListingCtaText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 4) return true;
  if (/^vedi\s+\d*\s*foto/i.test(t)) return true;
  if (/^vedi\s+(tutti|dettagli|annunci)/i.test(t)) return true;
  if (/^(see|view)\s+(all|details|photos)/i.test(t)) return true;
  return false;
}

export function isMeaningfulListingTitle(title?: string | null): boolean {
  const t = (title ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 8) return false;
  if (/^listing$/i.test(t)) return false;
  if (isGenericListingCtaText(t)) return false;
  return true;
}

/** "Un nuovo annuncio: 1.060 € | 88 mq | Via Filadelfia, Torino" */
export function parseCasaAlertSubject(subject: string): {
  title?: string;
  rentEur?: number;
  areaSqm?: number;
  locationHint?: string;
} {
  const m = subject.match(/^Un nuovo annuncio:\s*(.+)$/i);
  if (!m) return {};
  const body = m[1].trim();
  const parts = body.split('|').map((p) => p.trim());
  const rentEur = extractEur(body);
  const areaSqm = extractSqm(body);
  const locationHint =
    parts.length >= 3
      ? parts.slice(2).join(', ').slice(0, 120)
      : parts[parts.length - 1]?.slice(0, 120);
  const titleParts: string[] = [];
  if (areaSqm != null) titleParts.push(`${areaSqm} m²`);
  if (locationHint) titleParts.push(locationHint);
  return {
    rentEur,
    areaSqm,
    locationHint,
    title: titleParts.length ? titleParts.join(' — ') : body.slice(0, 200),
  };
}

export function buildCasaListingTitle(fields: {
  title?: string;
  areaSqm?: number;
  locationHint?: string;
  rentEur?: number;
}): string | undefined {
  if (isMeaningfulListingTitle(fields.title)) {
    return fields.title!.trim().slice(0, 200);
  }
  const parts: string[] = [];
  if (fields.areaSqm != null) parts.push(`${fields.areaSqm} m²`);
  if (fields.locationHint?.trim()) parts.push(fields.locationHint.trim());
  if (parts.length) return parts.slice(0, 2).join(' — ').slice(0, 200);
  if (fields.rentEur != null) {
    return `Affitto ${fields.rentEur} €/mese`.slice(0, 200);
  }
  return undefined;
}

export function extractCasaFieldsFromBlock(block: string): {
  rentEur?: number;
  areaSqm?: number;
  rooms?: number;
  locationHint?: string;
} {
  const rentEur = extractEur(block);
  const areaSqm = extractSqm(block);
  const rooms = extractRooms(block);
  const locMatch = block.match(
    /(?:Appartamento|Bilocale|Trilocale|Monolocale)?[^|€\n]{0,40}(?:in|a)\s+[^|€\n]{8,100}(?:,\s*Torino)?/i,
  );
  const locationHint =
    locMatch?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 120) ??
    (/,?\s*torino\b/i.test(block) ? 'Torino' : undefined);
  return {
    rentEur,
    areaSqm,
    rooms,
    locationHint,
  };
}
