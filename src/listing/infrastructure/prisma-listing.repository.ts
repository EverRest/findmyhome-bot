import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { ListingDraft } from '../domain/listing-draft';
import { computeListingFingerprint } from '../domain/listing-fingerprint';
import {
  pickBetterTitle,
  pickPreferredListingUrl,
} from '../domain/listing-url-preference';
import {
  ListingForDigest,
  ListingRepositoryPort,
  UpsertListingResult,
} from '../domain/listing.repository.port';

@Injectable()
export class PrismaListingRepository implements ListingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async existsProcessedEmail(gmailMessageId: string): Promise<boolean> {
    const row = await this.prisma.processedEmail.findUnique({
      where: { gmailMessageId },
    });
    return row != null;
  }

  async existsProcessedFacebookPost(postId: string): Promise<boolean> {
    const row = await this.prisma.processedFacebookPost.findUnique({
      where: { postId },
    });
    return row != null;
  }

  async markFacebookPostProcessed(
    postId: string,
    meta: {
      groupId: string;
      permalink?: string;
      message?: string;
      postedAt: Date;
      listingsFound: number;
    },
  ): Promise<void> {
    await this.prisma.processedFacebookPost.create({
      data: {
        postId,
        groupId: meta.groupId,
        permalink: meta.permalink,
        message: meta.message,
        postedAt: meta.postedAt,
        listingsFound: meta.listingsFound,
      },
    });
  }

  async markEmailProcessed(
    gmailMessageId: string,
    meta: {
      subject?: string;
      fromAddress?: string;
      receivedAt: Date;
      listingsFound: number;
    },
  ): Promise<void> {
    await this.prisma.processedEmail.create({
      data: {
        gmailMessageId,
        subject: meta.subject,
        fromAddress: meta.fromAddress,
        receivedAt: meta.receivedAt,
        listingsFound: meta.listingsFound,
      },
    });
  }

  async upsertFromDraft(draft: ListingDraft): Promise<UpsertListingResult> {
    const totalCostEur =
      draft.rentEur != null && draft.condoFeeEur != null
        ? draft.rentEur + draft.condoFeeEur
        : (draft.rentEur ?? null);

    const materialHash = this.hashMaterial(draft);
    const fingerprint = computeListingFingerprint(draft);

    let existing = await this.prisma.listing.findUnique({
      where: { canonicalUrl: draft.canonicalUrl },
    });

    if (!existing && fingerprint) {
      existing = await this.prisma.listing.findFirst({
        where: { listingFingerprint: fingerprint },
      });
    }

    if (!existing) {
      const created = await this.prisma.listing.create({
        data: {
          canonicalUrl: draft.canonicalUrl,
          listingUrl: draft.listingUrl,
          source: draft.source,
          externalId: draft.externalId,
          title: draft.title,
          addressRaw: draft.addressRaw,
          locationHint: draft.locationHint,
          rentEur: draft.rentEur,
          condoFeeEur: draft.condoFeeEur,
          totalCostEur: totalCostEur ?? undefined,
          areaSqm: draft.areaSqm,
          rooms: draft.rooms,
          floor: draft.floor,
          hasLift: draft.hasLift,
          rawSnippet: draft.rawSnippet,
          materialHash,
          listingFingerprint: fingerprint ?? undefined,
        },
      });
      return {
        listingId: created.id,
        isNew: true,
        priceChanged: false,
        materialChanged: false,
      };
    }

    const priceChanged =
      draft.rentEur != null &&
      existing.rentEur != null &&
      draft.rentEur !== existing.rentEur;
    const materialChanged = existing.materialHash !== materialHash;
    const alternateUrls = this.mergeAlternateUrls(
      existing.alternateUrls,
      existing.canonicalUrl,
      draft.canonicalUrl,
    );

    const updated = await this.prisma.listing.update({
      where: { id: existing.id },
      data: {
        listingUrl: pickPreferredListingUrl(
          existing.listingUrl,
          draft.listingUrl,
        ),
        title: pickBetterTitle(existing.title, draft.title),
        addressRaw: draft.addressRaw ?? existing.addressRaw,
        locationHint: draft.locationHint ?? existing.locationHint,
        rentEur: draft.rentEur ?? existing.rentEur,
        condoFeeEur: draft.condoFeeEur ?? existing.condoFeeEur,
        totalCostEur: totalCostEur ?? existing.totalCostEur,
        areaSqm: draft.areaSqm ?? existing.areaSqm,
        rooms: draft.rooms ?? existing.rooms,
        floor: draft.floor ?? existing.floor,
        hasLift: draft.hasLift ?? existing.hasLift,
        rawSnippet: draft.rawSnippet ?? existing.rawSnippet,
        materialHash,
        listingFingerprint: fingerprint ?? existing.listingFingerprint,
        alternateUrls,
        source: draft.source ?? existing.source,
        externalId: draft.externalId ?? existing.externalId,
        lastSeenAt: new Date(),
        priceChangedAt: priceChanged ? new Date() : existing.priceChangedAt,
      },
    });

    return {
      listingId: updated.id,
      isNew: false,
      priceChanged,
      materialChanged,
    };
  }

  async shouldSendToTelegram(listingId: string): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing || listing.dismissedAt) return false;
    if (!listing.telegramSentAt) return true;

    if (listing.priceChangedAt) {
      const sentBefore =
        listing.telegramSentAt.getTime() < listing.priceChangedAt.getTime();
      if (sentBefore) return true;
    }
    return false;
  }

  async markTelegramSent(listingId: string, messageId?: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        telegramSentAt: new Date(),
        telegramMessageId: messageId,
      },
    });
  }

  async markDismissed(listingId: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { dismissedAt: new Date() },
    });
  }

  async findByIdForDigest(id: string): Promise<ListingForDigest | null> {
    const row = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
    });
    if (!row || row.dismissedAt) return null;
    return this.mapRowToDigest(row);
  }

  async findTopForDigest(limit: number): Promise<ListingForDigest[]> {
    const rows = await this.prisma.listing.findMany({
      where: { dismissedAt: null, scores: { some: {} } },
      include: {
        scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
      take: limit * 3,
    });

    const mapped = rows
      .map((r) => this.mapRowToDigest(r))
      .filter((x): x is ListingForDigest => x != null);

    mapped.sort((a, b) => {
      const riskA = a.riskLevel === 'high' ? 1 : 0;
      const riskB = b.riskLevel === 'high' ? 1 : 0;
      if (riskA !== riskB) return riskA - riskB;
      return b.score - a.score;
    });

    return mapped.slice(0, limit);
  }

  private mapRowToDigest(r: {
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
    telegramSentAt: Date | null;
    priceChangedAt: Date | null;
    scores: {
      score: number;
      reasons: string;
      llmSummary: string | null;
      riskLevel: string;
      riskReasons: string;
    }[];
  }): ListingForDigest | null {
    const score = r.scores[0];
    if (!score) return null;
    return {
      id: r.id,
      canonicalUrl: r.canonicalUrl,
      listingUrl: r.listingUrl,
      source: r.source,
      title: r.title,
      rentEur: r.rentEur,
      condoFeeEur: r.condoFeeEur,
      totalCostEur: r.totalCostEur,
      areaSqm: r.areaSqm,
      rooms: r.rooms,
      locationHint: r.locationHint,
      listingFingerprint: r.listingFingerprint,
      score: score.score,
      reasons: JSON.parse(score.reasons) as string[],
      aiSuggestion: score.llmSummary?.trim() || null,
      riskLevel: score.riskLevel,
      riskReasons: JSON.parse(score.riskReasons) as string[],
      telegramSentAt: r.telegramSentAt,
      priceChangedAt: r.priceChangedAt,
    };
  }

  countDuplicateSkipsSince(_since: Date): Promise<number> {
    void _since;
    return Promise.resolve(0);
  }

  private mergeAlternateUrls(
    existingJson: string,
    existingCanonical: string,
    incomingCanonical: string,
  ): string {
    const urls = new Set<string>(JSON.parse(existingJson || '[]') as string[]);
    if (existingCanonical !== incomingCanonical) {
      urls.add(existingCanonical);
      urls.add(incomingCanonical);
    }
    return JSON.stringify([...urls]);
  }

  private hashMaterial(draft: ListingDraft): string {
    const payload = [
      draft.rentEur,
      draft.areaSqm,
      draft.rooms,
      draft.locationHint,
    ].join('|');
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }
}
