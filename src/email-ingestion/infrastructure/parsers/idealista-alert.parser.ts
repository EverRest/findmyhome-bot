import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ListingDraft } from '../../../listing/domain/listing-draft';
import { IncomingEmail } from '../../domain/incoming-email';
import { ListingParserPort } from '../../domain/listing-parser.port';
import {
  extractCondoFee,
  extractEur,
  extractRooms,
  extractRoomsFromItalianTitle,
  extractSqm,
} from './url.utils';
import {
  extractIdealistaImmobileId,
  idealistaImmobileUrl,
  isIdealistaAlertEmail,
  isIdealistaListingAnchorText,
} from './listing-url.utils';
import { hasMonthlyRentHint, isSaleAlertEmail } from './rental-listing.utils';

@Injectable()
export class IdealistaAlertParser implements ListingParserPort {
  readonly name = 'idealista-alert';

  canParse(email: IncomingEmail): boolean {
    return isIdealistaAlertEmail(email);
  }

  parse(email: IncomingEmail): ListingDraft[] {
    if (isSaleAlertEmail(email)) {
      return [];
    }

    const html = email.htmlBody || email.textBody;
    const $ = cheerio.load(html);
    const byId = new Map<string, ReturnType<typeof $>>();

    $('a[href*="/immobile/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const id = extractIdealistaImmobileId(href);
      if (!id) return;
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (!isIdealistaListingAnchorText(title)) return;
      const prev = byId.get(id);
      if (!prev || title.length > prev.text().trim().length) {
        byId.set(id, $(el));
      }
    });

    const drafts: ListingDraft[] = [];
    for (const [id, titleEl] of byId) {
      const title = titleEl.text().replace(/\s+/g, ' ').trim();
      const block = findIdealistaListingBlock(titleEl);
      const rentEur = hasMonthlyRentHint(block) ? extractEur(block) : undefined;
      const rooms =
        extractRooms(block) ??
        extractRoomsFromItalianTitle(title) ??
        extractRoomsFromItalianTitle(block);
      const areaSqm = extractSqm(block);
      const listingUrl = idealistaImmobileUrl(id);

      drafts.push({
        canonicalUrl: listingUrl,
        listingUrl,
        source: 'idealista.it',
        externalId: id,
        title: title.slice(0, 200),
        locationHint: extractLocationHint(title),
        rentEur,
        condoFeeEur: extractCondoFee(block),
        areaSqm,
        rooms,
        rawSnippet: block.slice(0, 400),
      });
    }

    return drafts;
  }
}

function findIdealistaListingBlock(
  titleLink: ReturnType<ReturnType<typeof cheerio.load>>,
): string {
  let el = titleLink;
  for (let i = 0; i < 30; i++) {
    el = el.parent();
    const t = el.text().replace(/\s+/g, ' ').trim();
    if (/€/.test(t) && /m²|stanze|locali/i.test(t)) {
      return t.slice(0, 600);
    }
  }
  return titleLink
    .closest('table')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function extractLocationHint(title: string): string | undefined {
  const m = title.match(/\b(?:in|a)\s+(.+)$/i);
  return m?.[1]?.trim().slice(0, 120) ?? title.slice(0, 120);
}
