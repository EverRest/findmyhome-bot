/** Tracking / marketing hosts — never treat as listing pages. */
const BLOCKED_HOST_PREFIXES = ['clicks.', 'click.', 'track.', 'email.'];

const LISTING_PATH_PATTERNS: Record<string, RegExp[]> = {
  'immobiliare.it': [/\/annunci\/\d+/i, /\/affitto-/i],
  'idealista.it': [
    /\/immobile\/\d+/i,
    /\/affitto\//i,
    /\/inmueble\//i,
    /\/proprieta\//i,
  ],
  'idealista.com': [/\/immobile\/\d+/i, /\/affitto\//i, /\/inmueble\//i],
  'fotocasa.es': [/\/alquiler\//i, /\/comprar\//i],
  'casa.it': [/\/immobili\/\d+/i, /\/annunci\/\d+/i],
  'subito.it': [/\/affitto\//i, /\/case\//i],
};

export function isListingPageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (BLOCKED_HOST_PREFIXES.some((p) => host.startsWith(p))) {
      return false;
    }

    for (const [domain, patterns] of Object.entries(LISTING_PATH_PATTERNS)) {
      if (!host.endsWith(domain)) continue;
      return patterns.some((re) => re.test(url.pathname + url.search));
    }

    return false;
  } catch {
    return false;
  }
}

export function isImmobiliareAlertEmail(email: {
  fromAddress: string;
  subject: string;
}): boolean {
  const from = email.fromAddress.toLowerCase();
  const subj = email.subject.toLowerCase();
  return (
    from.includes('immobiliare.it') ||
    subj.includes('listings for your search') ||
    subj.includes('nuovi annunci')
  );
}

const FOOTER_LINK_TEXT =
  /^(disable search|manage search|start search|download the app|discover|privacy|general conditions|see details|unsubscribe|view all|see all)$/i;

export function isImmobiliareListingAnchorText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 15) return false;
  if (FOOTER_LINK_TEXT.test(t)) return false;
  return /(\d+[- ]room|bedroom|locali|bilocale|trilocale|quadri|appartamento|flat|villa|villetta|loft|studio)/i.test(
    t,
  );
}

export function isIdealistaAlertEmail(email: { fromAddress: string }): boolean {
  return email.fromAddress.toLowerCase().includes('idealista');
}

export function extractIdealistaImmobileId(href: string): string | undefined {
  const m = href.match(/\/immobile\/(\d+)/i);
  return m?.[1];
}

export function idealistaImmobileUrl(id: string): string {
  return `https://www.idealista.it/immobile/${id}/`;
}

export function isIdealistaListingAnchorText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (FOOTER_LINK_TEXT.test(t)) return false;
  if (/^vedi\s+\d+\s+foto$/i.test(t)) return false;
  if (/^contatta$/i.test(t)) return false;
  if (/^vedi tutti gli annunci/i.test(t)) return false;
  return (
    /^(trilocale|bilocale|monolocale|quadri|quadrilocale|appartamento|attico|villetta|villa|loft|rustico|casa|stanza)\b/i.test(
      t,
    ) || /\b(in|a)\s+via\b/i.test(t)
  );
}
