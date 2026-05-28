import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { OllamaAdapter } from '../infrastructure/ollama.adapter';
import { meetsHardCriteria } from '../../listing/domain/listing-hard-criteria';
import { RuleScorerService } from './rule-scorer.service';
import { GeocodeListingService } from './geocode-listing.service';
import { applyProximityToLlmResult } from '../domain/llm-rating.parser';

@Injectable()
export class ScoreListingsUseCase {
  private readonly log;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RuleScorerService,
    private readonly ollama: OllamaAdapter,
    private readonly geocode: GeocodeListingService,
    private readonly criteria: CriteriaLoaderService,
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(ScoreListingsUseCase.name);
  }

  async execute(): Promise<number> {
    const cacheDays = Number(this.config.get('SCORE_CACHE_DAYS') ?? 7);
    const since = new Date(Date.now() - cacheDays * 86400000);
    const weights = this.criteria.get().scoring;
    const referenceName = weights.referencePoint?.name ?? null;

    const listings = await this.prisma.listing.findMany({
      where: { dismissedAt: null },
      include: {
        scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
      take: 100,
    });

    this.log.info('score', 'Candidates loaded', {
      total: listings.length,
      cacheDays,
    });

    let scored = 0;
    let skippedCache = 0;
    let skippedHardCriteria = 0;
    const searchCriteria = this.criteria.get();

    for (const listing of listings) {
      const latest = listing.scores[0];
      if (
        latest &&
        latest.scoredAt >= since &&
        listing.lastSeenAt <= latest.scoredAt
      ) {
        skippedCache++;
        this.log.debug('score', 'Skip — score cache hit', {
          listingId: listing.id,
          url: listing.canonicalUrl,
          lastScore: latest.score,
          scoredAt: latest.scoredAt.toISOString(),
        });
        continue;
      }

      const draft = {
        canonicalUrl: listing.canonicalUrl,
        title: listing.title ?? undefined,
        locationHint: listing.locationHint ?? undefined,
        rentEur: listing.rentEur ?? undefined,
        condoFeeEur: listing.condoFeeEur ?? undefined,
        areaSqm: listing.areaSqm ?? undefined,
        rooms: listing.rooms ?? undefined,
        rawSnippet: listing.rawSnippet ?? undefined,
      };

      if (!meetsHardCriteria(draft, searchCriteria)) {
        skippedHardCriteria++;
        this.log.debug('score', 'Skip — hard criteria (no AI)', {
          listingId: listing.id,
          url: listing.canonicalUrl,
        });
        continue;
      }

      const proximity = this.geocode.isProximityEnabled()
        ? await this.geocode.resolveProximity({
            id: listing.id,
            lat: listing.lat,
            lng: listing.lng,
            locationHint: listing.locationHint,
            title: listing.title,
          })
        : {
            lat: listing.lat,
            lng: listing.lng,
            geocodeSource: null,
            distanceM: listing.distanceToRefM,
            proximityScore: listing.proximityScore,
          };

      const ruleResult = this.rules.score({
        draft,
        snippet: listing.rawSnippet ?? '',
        proximityScore: proximity.proximityScore,
        distanceM: proximity.distanceM,
        referenceName,
      });
      let score = Math.round(ruleResult.score * weights.rulesWeight);
      const reasons = [...ruleResult.reasons];
      let riskLevel = ruleResult.riskLevel;
      const riskReasons = [...ruleResult.riskReasons];
      const riskSource = ruleResult.riskSource;
      let model: string | undefined;

      this.log.debug('score', 'Rules applied', {
        url: listing.canonicalUrl,
        ruleScore: ruleResult.score,
        weighted: score,
        riskLevel: ruleResult.riskLevel,
        reasons: ruleResult.reasons.slice(0, 4),
      });

      const llmEnabled =
        this.config.get<string>('OLLAMA_SCORING_ENABLED') !== 'false';
      let llm = llmEnabled
        ? await this.ollama.assessListing(draft, listing.id)
        : null;

      if (
        llm &&
        proximity.proximityScore != null &&
        this.geocode.isProximityEnabled()
      ) {
        const defs = searchCriteria.llmRating?.criteria ?? [];
        llm = applyProximityToLlmResult(llm, proximity.proximityScore, defs);
      }

      if (llm) {
        model = this.config.get<string>('OLLAMA_MODEL') ?? 'ollama';
        const blended = Math.round(
          score * weights.rulesWeight + llm.compositeScore * weights.llmWeight,
        );
        score = blended;
        reasons.push(...llm.displayReasons);
        if (llm.riskLevel === 'high') {
          riskLevel = 'high';
          riskReasons.push(...llm.riskReasons);
        }
        this.log.debug('score', 'LLM 10-criteria rating', {
          url: listing.canonicalUrl,
          compositeScore: llm.compositeScore,
          blended,
          criteria: llm.criteria,
        });
      }

      score = Math.max(0, Math.min(100, score));

      await this.prisma.listingScore.create({
        data: {
          listingId: listing.id,
          score,
          reasons: JSON.stringify(reasons),
          llmSummary: llm?.summary?.trim() || null,
          riskLevel,
          riskReasons: JSON.stringify(riskReasons),
          riskSource,
          model,
        },
      });

      this.log.info('score', 'Listing scored', {
        url: listing.canonicalUrl,
        finalScore: score,
        riskLevel,
        riskSource,
        model: model ?? 'rules-only',
      });
      scored++;
    }

    this.log.step('score', 'Scoring finished', {
      scored,
      skippedCache,
      skippedHardCriteria,
      examined: listings.length,
    });
    return scored;
  }
}
