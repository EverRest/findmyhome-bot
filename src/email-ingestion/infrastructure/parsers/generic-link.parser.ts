import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ListingDraft } from '../../../listing/domain/listing-draft';
import { IncomingEmail } from '../../domain/incoming-email';
import { ListingParserPort } from '../../domain/listing-parser.port';
import {
  canonicalizeUrl,
  extractCondoFee,
  extractEur,
  extractRooms,
  extractSqm,
} from './url.utils';
import { isListingPageUrl } from './listing-url.utils';
import {
  buildCasaListingTitle,
  extractCasaFieldsFromBlock,
  isCasaAlertEmail,
  isGenericListingCtaText,
  parseCasaAlertSubject,
} from './casa-alert.utils';

const DEFAULT_DOMAINS = [
  'idealista.it',
  'idealista.com',
  'fotocasa.es',
  'immobiliare.it',
  'casa.it',
  'subito.it',
];

@Injectable()
export class GenericLinkParser implements ListingParserPort {
  readonly name = 'generic-link';

  canParse(_email: IncomingEmail): boolean {
    void _email;
    return true;
  }

  parse(email: IncomingEmail): ListingDraft[] {
    const html = email.htmlBody || email.textBody;
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const drafts: ListingDraft[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const canonical = canonicalizeUrl(href);
      if (!canonical || !this.isAllowed(canonical)) return;
      if (seen.has(canonical)) return;
      seen.add(canonical);

      const linkEl = $(el);
      const linkText = linkEl.text().replace(/\s+/g, ' ').trim();
      const isCasa = isCasaAlertEmail(email.fromAddress);
      const fromCasaSubject = isCasa
        ? parseCasaAlertSubject(email.subject ?? '')
        : {};
      const listingBlock = isCasa
        ? this.findCasaListingBlock(linkEl)
        : linkEl.parent().text().replace(/\s+/g, ' ').trim();
      const block = `${email.subject} ${listingBlock} ${linkText}`
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      const fromBlock = isCasa ? extractCasaFieldsFromBlock(listingBlock) : {};
      const rentEur =
        extractEur(block) ?? fromBlock.rentEur ?? fromCasaSubject.rentEur;
      const condoFeeEur = extractCondoFee(block);
      const areaSqm =
        extractSqm(block) ?? fromBlock.areaSqm ?? fromCasaSubject.areaSqm;
      const locationHint =
        fromCasaSubject.locationHint ??
        fromBlock.locationHint ??
        (isCasa ? undefined : listingBlock.slice(0, 120) || undefined);
      const title = isCasa
        ? buildCasaListingTitle({
            title: isGenericListingCtaText(linkText)
              ? fromCasaSubject.title
              : linkText.slice(0, 200) || fromCasaSubject.title,
            areaSqm,
            locationHint,
            rentEur,
          })
        : isGenericListingCtaText(linkText)
          ? fromCasaSubject.title
          : linkText.slice(0, 200) || fromCasaSubject.title;

      drafts.push({
        canonicalUrl: canonical,
        source: this.detectSource(canonical),
        title,
        locationHint,
        rentEur,
        condoFeeEur,
        areaSqm,
        rooms:
          extractRooms(block) ?? fromBlock.rooms ?? extractRooms(listingBlock),
        rawSnippet: block.slice(0, 400),
      });
    });

    return drafts;
  }

  private isAllowed(url: string): boolean {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (!DEFAULT_DOMAINS.some((d) => host.endsWith(d))) return false;
      return isListingPageUrl(url);
    } catch {
      return false;
    }
  }

  private findCasaListingBlock(
    link: ReturnType<ReturnType<typeof cheerio.load>>,
  ): string {
    let el = link;
    for (let i = 0; i < 25; i++) {
      el = el.parent();
      const t = el.text().replace(/\s+/g, ' ').trim();
      if (/€/.test(t) && /m(?:q|²|2)\b/i.test(t)) {
        return t.slice(0, 600);
      }
    }
    return link
      .closest('table')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600);
  }

  private detectSource(url: string): string | undefined {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host.split('.').slice(-2).join('.');
    } catch {
      return undefined;
    }
  }
}
