import { extractEur, extractSqm } from './url.utils';

export function isGenericListingCtaText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 4) return true;
  if (/^vedi\s+\d*\s*foto/i.test(t)) return true;
  if (/^vedi\s+(tutti|dettagli|annunci)/i.test(t)) return true;
  if (/^(see|view)\s+(all|details|photos)/i.test(t)) return true;
  return false;
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
