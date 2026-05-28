import { IncomingEmail } from '../../domain/incoming-email';
import { ListingDraft } from '../../../listing/domain/listing-draft';
import { isCasaAlertEmail, isMeaningfulListingTitle } from './casa-alert.utils';

/**
 * Sale alerts (Idealista vendita, Immobiliare vendita) must not enter the DB.
 * Rent-only app — see config/criteria.yaml (rent 500–1000 €/mese).
 */
export function isSaleAlertEmail(
  email: Pick<
    IncomingEmail,
    'subject' | 'htmlBody' | 'textBody' | 'fromAddress'
  >,
): boolean {
  const html = (email.htmlBody || email.textBody || '').toLowerCase();
  const subj = (email.subject ?? '').toLowerCase();
  const blob = `${html} ${subj}`;

  if (
    /affitto-case|\/affitto-|properties for rent|for rent in|in affitto/i.test(
      blob,
    )
  ) {
    return false;
  }

  if (
    /vendita-case|\/vendita-|in vendita|[_-]sale[_-]|sale_professional|newad_sale/i.test(
      blob,
    )
  ) {
    return true;
  }

  return false;
}

export function hasMonthlyRentHint(text: string): boolean {
  return /(?:€\s*[\d.,\s]+\s*\/?\s*(?:month|mese|mo\b)|\/mese|al mese|affitto\s+\d|rent\s+\d)/i.test(
    text,
  );
}

/** Gate before DB upsert — rental listings only. */
export function shouldPersistListingDraft(
  draft: ListingDraft,
  email: Pick<
    IncomingEmail,
    'subject' | 'htmlBody' | 'textBody' | 'fromAddress'
  >,
): boolean {
  if (isSaleAlertEmail(email)) {
    return false;
  }

  const snippet = draft.rawSnippet ?? '';
  const title = draft.title ?? '';

  if (email.fromAddress.toLowerCase().includes('idealista')) {
    return draft.rentEur != null && hasMonthlyRentHint(`${snippet} ${title}`);
  }

  if (isCasaAlertEmail(email.fromAddress)) {
    if (draft.rentEur == null) return false;
    if (!isMeaningfulListingTitle(draft.title)) return false;
    if (draft.areaSqm == null && !draft.locationHint?.trim()) return false;
    return true;
  }

  if (
    draft.rentEur != null &&
    draft.rentEur > 1_500 &&
    !hasMonthlyRentHint(snippet)
  ) {
    return false;
  }

  return true;
}
