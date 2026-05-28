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

export function isStudentHousingPost(text: string): boolean {
  const blob = text.replace(/\s+/g, ' ').trim();
  if (!blob) return false;
  return STUDENT_MARKERS.some((re) => re.test(blob));
}

export function looksLikeRentalPost(text: string): boolean {
  const blob = text.replace(/\s+/g, ' ').trim();
  if (!blob || blob.length < 20) return false;
  if (SALE_MARKERS.some((re) => re.test(blob)) && !/\baffitt/i.test(blob)) {
    return false;
  }
  return RENT_MARKERS.some((re) => re.test(blob));
}

export function shouldPersistFacebookListing(
  draft: ListingDraft,
  postText: string,
): boolean {
  const blob = `${postText} ${draft.title ?? ''} ${draft.rawSnippet ?? ''}`;

  if (isStudentHousingPost(blob)) {
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

  return true;
}
