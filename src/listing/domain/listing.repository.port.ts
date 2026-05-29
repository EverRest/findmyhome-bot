import { ListingDraft } from './listing-draft';

export const LISTING_REPOSITORY = Symbol('LISTING_REPOSITORY');

export interface UpsertListingResult {
  listingId: string;
  isNew: boolean;
  priceChanged: boolean;
  materialChanged: boolean;
}

export interface PossibleDuplicateRef {
  id: string;
  source: string | null;
  canonicalUrl: string;
  title: string | null;
}

export interface ListingForDigest {
  id: string;
  canonicalUrl: string;
  listingUrl: string | null;
  source: string | null;
  title: string | null;
  rentEur: number | null;
  condoFeeEur: number | null;
  totalCostEur: number | null;
  areaSqm: number | null;
  rooms: number | null;
  locationHint: string | null;
  listingFingerprint: string | null;
  possibleDuplicateOf: PossibleDuplicateRef | null;
  distanceToRefM: number | null;
  score: number;
  reasons: string[];
  /** One-sentence AI tip for Telegram (from Ollama summary). */
  aiSuggestion: string | null;
  riskLevel: string;
  riskReasons: string[];
  telegramSentAt: Date | null;
  priceChangedAt: Date | null;
}

export interface ListingRepositoryPort {
  existsProcessedEmail(gmailMessageId: string): Promise<boolean>;
  existsProcessedFacebookPost(postId: string): Promise<boolean>;
  markEmailProcessed(
    gmailMessageId: string,
    meta: {
      subject?: string;
      fromAddress?: string;
      receivedAt: Date;
      listingsFound: number;
    },
  ): Promise<void>;
  markFacebookPostProcessed(
    postId: string,
    meta: {
      groupId: string;
      permalink?: string;
      message?: string;
      postedAt: Date;
      listingsFound: number;
    },
  ): Promise<void>;

  upsertFromDraft(draft: ListingDraft): Promise<UpsertListingResult>;

  /** Re-link possibleDuplicateOfId by propertyMatchKey (street + rooms + rent). */
  reconcilePossibleDuplicates(): Promise<number>;

  shouldSendToTelegram(listingId: string): Promise<boolean>;
  markTelegramSent(listingId: string, messageId?: string): Promise<void>;
  markDismissed(listingId: string): Promise<void>;

  findTopForDigest(limit: number): Promise<ListingForDigest[]>;
  findByIdForDigest(id: string): Promise<ListingForDigest | null>;
  countDuplicateSkipsSince(since: Date): Promise<number>;
}
