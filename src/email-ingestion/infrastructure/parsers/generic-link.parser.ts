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

      const context = $(el).parent().text().replace(/\s+/g, ' ').trim();
      const block = `${email.subject} ${context} ${$(el).text()}`
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      const linkText = $(el).text().replace(/\s+/g, ' ').trim();
      const fromCasaSubject = email.fromAddress
        .toLowerCase()
        .includes('casa.it')
        ? parseCasaAlertSubject(email.subject ?? '')
        : {};
      const rentEur = extractEur(block) ?? fromCasaSubject.rentEur;
      const condoFeeEur = extractCondoFee(block);
      const areaSqm = extractSqm(block) ?? fromCasaSubject.areaSqm;

      drafts.push({
        canonicalUrl: canonical,
        source: this.detectSource(canonical),
        title: isGenericListingCtaText(linkText)
          ? fromCasaSubject.title
          : linkText.slice(0, 200) || fromCasaSubject.title,
        locationHint:
          fromCasaSubject.locationHint || context.slice(0, 120) || undefined,
        rentEur,
        condoFeeEur,
        areaSqm,
        rooms: extractRooms(block),
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

  private detectSource(url: string): string | undefined {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host.split('.').slice(-2).join('.');
    } catch {
      return undefined;
    }
  }
}
