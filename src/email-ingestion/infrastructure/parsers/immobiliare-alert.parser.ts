import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { ListingDraft } from '../../../listing/domain/listing-draft';
import { IncomingEmail } from '../../domain/incoming-email';
import { ListingParserPort } from '../../domain/listing-parser.port';
import {
  extractCondoFee,
  extractEur,
  extractRooms,
  extractSqm,
} from './url.utils';
import {
  isImmobiliareAlertEmail,
  isImmobiliareListingAnchorText,
} from './listing-url.utils';

@Injectable()
export class ImmobiliareAlertParser implements ListingParserPort {
  readonly name = 'immobiliare-alert';

  canParse(email: IncomingEmail): boolean {
    return isImmobiliareAlertEmail(email);
  }

  parse(email: IncomingEmail): ListingDraft[] {
    const html = email.htmlBody || email.textBody;
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const drafts: ListingDraft[] = [];

    $('a[href*="clicks.immobiliare"]').each((_, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (!isImmobiliareListingAnchorText(title)) return;

      const href = $(el).attr('href');
      if (!href) return;

      const block = $(el)
        .closest('table')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);

      const rentEur = extractEur(block);
      const rooms =
        extractRooms(block) ??
        extractRooms(title) ??
        extractRoomsFromTitle(title);
      const areaSqm = extractSqm(block);
      const locationHint = extractLocationHint(title, block);

      const canonicalUrl = stableImmobiliareAlertUrl(title, rentEur, areaSqm);

      if (seen.has(canonicalUrl)) return;
      seen.add(canonicalUrl);

      drafts.push({
        canonicalUrl,
        listingUrl: normalizeClickHref(href),
        source: 'immobiliare.it',
        title: title.slice(0, 200),
        locationHint,
        rentEur,
        condoFeeEur: extractCondoFee(block),
        areaSqm,
        rooms,
        rawSnippet: block.slice(0, 400),
        externalId: extractClickId(href),
      });
    });

    return drafts;
  }
}

function extractRoomsFromTitle(title: string): number | undefined {
  const m = title.match(/^(\d+)[- ]room/i);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractLocationHint(title: string, block: string): string | undefined {
  const afterVia = title.match(/(?:flat|appartamento|villetta)\s+(.+)$/i);
  if (afterVia) return afterVia[1].slice(0, 120);

  const zone = block.match(/,\s*([A-Za-zÀ-ÿ0-9\s.'-]+),\s*Turin/i);
  if (zone) return zone[1].trim().slice(0, 120);

  return title.slice(0, 120);
}

/** Stable id — click URLs change between emails. */
export function stableImmobiliareAlertUrl(
  title: string,
  rentEur: number | undefined,
  areaSqm: number | undefined,
): string {
  const key = `${title.toLowerCase()}|${rentEur ?? ''}|${areaSqm ?? ''}`;
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 20);
  return `https://www.immobiliare.it/annunci/alert-${hash}/`;
}

function extractClickId(href: string): string | undefined {
  const m = href.match(/\/f\/a\/([^/~]+)/);
  return m?.[1]?.slice(0, 12);
}

function normalizeClickHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
