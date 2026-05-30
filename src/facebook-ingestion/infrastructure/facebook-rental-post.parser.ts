import { Injectable } from '@nestjs/common';
import { ListingDraft } from '../../listing/domain/listing-draft';
import type { IncomingFacebookPost } from '../domain/incoming-facebook-post';
import {
  canonicalizeUrl,
  extractCondoFee,
  extractEur,
  extractRooms,
  extractSqm,
} from '../../email-ingestion/infrastructure/parsers/url.utils';
import { isListingPageUrl } from '../../email-ingestion/infrastructure/parsers/listing-url.utils';
import { cleanFacebookMessage } from './facebook-rental-post.utils';

const PORTAL_HOST = /idealista\.|immobiliare\.|casa\.it|subito\.it|fotocasa\./i;

@Injectable()
export class FacebookRentalPostParser {
  parse(post: IncomingFacebookPost): ListingDraft[] {
    const text = cleanFacebookMessage(post.message.replace(/\s+/g, ' ').trim());
    if (!text && !post.permalink) return [];

    const drafts: ListingDraft[] = [];
    const seen = new Set<string>();

    for (const url of extractUrls(text)) {
      const canonical = canonicalizeUrl(url);
      if (!canonical || seen.has(canonical)) continue;
      if (!isListingPageUrl(canonical) && !PORTAL_HOST.test(canonical))
        continue;
      seen.add(canonical);

      const block = `${text} ${url}`.slice(0, 500);
      drafts.push(this.buildDraft(canonical, block, post, url));
    }

    if (drafts.length === 0 && text.length >= 30) {
      drafts.push(this.buildDraft(post.permalink, text, post, post.permalink));
    }

    return drafts;
  }

  private buildDraft(
    canonicalUrl: string,
    block: string,
    post: IncomingFacebookPost,
    listingUrl: string,
  ): ListingDraft {
    const cleaned = cleanFacebookMessage(post.message);
    const firstLine =
      cleaned
        .split(/[.\n]/)
        .map((l) => l.trim())
        .find((l) => l.length > 10) ?? cleaned.slice(0, 120);

    return {
      canonicalUrl,
      listingUrl: listingUrl.startsWith('http') ? listingUrl : post.permalink,
      source: 'facebook.group',
      externalId: post.postId,
      title: firstLine.slice(0, 200) || 'Facebook listing',
      locationHint: extractLocationHint(block),
      rentEur: extractEur(block),
      condoFeeEur: extractCondoFee(block),
      areaSqm: extractSqm(block),
      rooms: extractRooms(block),
      rawSnippet: block.slice(0, 400),
    };
  }
}

function extractUrls(text: string): string[] {
  const urls: string[] = [];
  const re = /https?:\/\/[^\s<>"')]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0].replace(/[.,;:!?)]+$/, ''));
  }
  return urls;
}

function extractLocationHint(text: string): string | undefined {
  const torino = text.match(
    /\b(?:Torino|Turin|Cenisia|Cit Turin|Pozzo Strada|San Donato|Rivoli|Bernini)\b[^.,\n]{0,40}/i,
  );
  return torino?.[0].trim().slice(0, 120);
}
