export interface ListingDraft {
  canonicalUrl: string;
  /** Browser-openable link (Immobiliare: clicks.immobiliare.it from alert email). */
  listingUrl?: string;
  source?: string;
  externalId?: string;
  title?: string;
  addressRaw?: string;
  locationHint?: string;
  rentEur?: number;
  condoFeeEur?: number;
  areaSqm?: number;
  rooms?: number;
  floor?: number;
  hasLift?: boolean;
  rawSnippet?: string;
}
