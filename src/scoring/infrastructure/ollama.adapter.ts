import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { ListingDraft } from '../../listing/domain/listing-draft';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import type { LlmRatingResult } from '../domain/llm-rating.types';
import { parseLlmRatingResponse } from '../domain/llm-rating.parser';
import { buildLlmRatingPrompt } from './llm-rating-prompt';

@Injectable()
export class OllamaAdapter {
  private readonly log;

  constructor(
    private readonly config: ConfigService,
    private readonly criteria: CriteriaLoaderService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(OllamaAdapter.name);
  }

  async assessListing(
    draft: ListingDraft,
    listingId?: string,
  ): Promise<LlmRatingResult | null> {
    const c = this.criteria.get();
    if (!c.llmRating?.prompt || !c.llmRating.criteria.length) {
      this.log.warn('ollama', 'llmRating missing in criteria — skip');
      return null;
    }

    const baseUrl =
      this.config.get<string>('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'llama3.2:3b';
    const prompt = buildLlmRatingPrompt(c, draft);

    const start = Date.now();
    this.log.debug('ollama', 'Rating request', {
      listingId,
      model,
      baseUrl,
      url: draft.canonicalUrl,
    });

    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: { temperature: 0.15 },
        }),
      });

      if (!res.ok) {
        this.log.warn('ollama', 'HTTP error', {
          status: res.status,
          ms: Date.now() - start,
        });
        return null;
      }

      const body = (await res.json()) as { response?: string };
      const parsed = JSON.parse(body.response ?? '{}') as Record<
        string,
        unknown
      >;
      const result = parseLlmRatingResponse(parsed, c.llmRating.criteria);
      if (!result) {
        this.log.warn('ollama', 'Empty criteria scores in response', {
          listingId,
          ms: Date.now() - start,
        });
        return null;
      }

      this.log.debug('ollama', 'Rating OK', {
        listingId,
        ms: Date.now() - start,
        compositeScore: result.compositeScore,
        criteria: result.criteria,
      });

      return result;
    } catch (err) {
      this.log.warn('ollama', 'Unavailable — rules only', {
        listingId,
        ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
