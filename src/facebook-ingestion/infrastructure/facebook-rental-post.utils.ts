import { ListingDraft } from '../../listing/domain/listing-draft';
import { hasMonthlyRentHint } from '../../email-ingestion/infrastructure/parsers/rental-listing.utils';

/** Posts aimed at students / shared rooms — not for family-with-child search. */
const STUDENT_MARKERS = [
  /\bstudenti\b/i,
  /\bstudent\b/i,
  /\bstudents\b/i,
  /\buniversitar/i,
  /\buniversità\b/i,
  /\buniversita\b/i,
  /\bsolo\s+student/i,
  /\bper\s+student/i,
  /\bstudentesco\b/i,
  /\berasmus\b/i,
  /\bposto\s+letto\b/i,
  /\bcamera\s+in\s+affitto\b/i,
  /\bstanza\s+(?:singola|doppia)\b/i,
  /\broom\s+for\s+rent\b/i,
  /\bflat\s*share\b/i,
  /\bcoliving\b/i,
];

const RENT_MARKERS = [
  /\baffitt/i,
  /\baffitto\b/i,
  /\brent\b/i,
  /\blocation\b/i,
  /\b€\s*\d/i,
  /\d\s*€/i,
  /\blocali\b/i,
  /\bmq\b/i,
  /\bm²\b/i,
  /\btrilocale\b/i,
  /\bbilocale\b/i,
];

const SALE_MARKERS = [/\bin\s+vendita\b/i, /\bvendita\b/i, /\bsale\b/i];

/** Scraped FB feed UI / comment-thread noise (not listing text). */
const FEED_UI_MARKERS = [
  /\bLike\s+Reply\b/i,
  /\bLike\s*·\s*Comment\b/i,
  /\bSee translation\b/i,
  /\bView all \d+ repl/i,
  /\bWrite a public comment\b/i,
  /\b\d+[mhd]\s+Like\b/i,
];

/** Short replies in threads — not standalone listings. */
const CONVERSATION_MARKERS = [
  /\bmi interessa\b/i,
  /\bsono interessat[oa]\b/i,
  /\bscritto in privato\b/i,
  /\ble ho scritto\b/i,
  /\bbuongiorno,?\s+le ho scritto\b/i,
  /\bsarebbe di tuo interesse\b/i,
  /\bciao\s+\w+,?\s+mia mamma\b/i,
];

export function isFacebookPermalinkDraft(draft: ListingDraft): boolean {
  return /facebook\.com/i.test(draft.canonicalUrl);
}

export function isStudentHousingPost(text: string): boolean {
  const blob = text.replace(/\s+/g, ' ').trim();
  if (!blob) return false;
  return STUDENT_MARKERS.some((re) => re.test(blob));
}

export function isFacebookFeedNoise(text: string): boolean {
  const blob = text.replace(/\s+/g, ' ').trim();
  if (!blob) return false;
  return FEED_UI_MARKERS.some((re) => re.test(blob));
}

/** Strip comment UI and thread tail from scraped FB text. */
export function cleanFacebookMessage(text: string): string {
  let s = text.replace(/\s+/g, ' ').trim();
  for (const re of FEED_UI_MARKERS) {
    const idx = s.search(re);
    if (idx > 20) s = s.slice(0, idx).trim();
  }
  return s;
}

export function looksLikeRentalPost(text: string): boolean {
  const blob = cleanFacebookMessage(text);
  if (!blob || blob.length < 20) return false;
  if (SALE_MARKERS.some((re) => re.test(blob)) && !/\baffitt/i.test(blob)) {
    return false;
  }
  return RENT_MARKERS.some((re) => re.test(blob));
}

function hasExplicitRentInText(text: string): boolean {
  return /(?:€\s*\d{2,4}|\d{2,4}\s*€|\d{2,4}\s*(?:€|eur|euro)\s*(?:\/|\b)?\s*(?:mese|mo|month))/i.test(
    text,
  );
}

function isConversationOnly(text: string): boolean {
  const blob = cleanFacebookMessage(text);
  if (CONVERSATION_MARKERS.some((re) => re.test(blob))) {
    return !hasExplicitRentInText(blob) && !/\baffitt/i.test(blob);
  }
  return false;
}

export function isEligibleFacebookDigestListing(item: {
  title?: string | null;
  rentEur?: number | null;
  areaSqm?: number | null;
  rooms?: number | null;
  locationHint?: string | null;
}): boolean {
  const title = item.title ?? '';
  if (isFacebookFeedNoise(title)) return false;
  if (isConversationOnly(title)) return false;
  if (item.rentEur == null || item.rentEur < 200) return false;
  if (
    item.areaSqm == null &&
    item.rooms == null &&
    !item.locationHint?.trim()
  ) {
    return false;
  }
  return title.trim().length >= 15;
}

export function shouldPersistFacebookListing(
  draft: ListingDraft,
  postText: string,
): boolean {
  const blob = cleanFacebookMessage(
    `${postText} ${draft.title ?? ''} ${draft.rawSnippet ?? ''}`,
  );

  if (isStudentHousingPost(blob)) {
    return false;
  }

  if (isFacebookFeedNoise(blob)) {
    return false;
  }

  if (isConversationOnly(blob)) {
    return false;
  }

  if (!looksLikeRentalPost(blob)) {
    return false;
  }

  if (
    draft.rentEur != null &&
    draft.rentEur > 1_500 &&
    !hasMonthlyRentHint(blob)
  ) {
    return false;
  }

  if (isFacebookPermalinkDraft(draft)) {
    const hasRent =
      draft.rentEur != null && draft.rentEur >= 200 && draft.rentEur <= 1500;
    const hasPrice = hasExplicitRentInText(blob);
    const hasFacts =
      draft.rentEur != null &&
      (draft.rooms != null || draft.areaSqm != null || draft.locationHint);
    if (!hasRent && !hasPrice) return false;
    if (!hasFacts && !hasPrice) return false;
  }

  return true;
}
