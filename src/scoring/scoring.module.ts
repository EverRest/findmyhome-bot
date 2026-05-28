import { Module } from '@nestjs/common';
import { ScoreListingsUseCase } from './application/score-listings.use-case';
import { RuleScorerService } from './application/rule-scorer.service';
import { OllamaAdapter } from './infrastructure/ollama.adapter';

@Module({
  providers: [RuleScorerService, OllamaAdapter, ScoreListingsUseCase],
  exports: [ScoreListingsUseCase],
})
export class ScoringModule {}
