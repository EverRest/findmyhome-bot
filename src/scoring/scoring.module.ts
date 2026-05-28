import { Module } from '@nestjs/common';
import { ScoreListingsUseCase } from './application/score-listings.use-case';
import { RuleScorerService } from './application/rule-scorer.service';
import { GeocodeListingService } from './application/geocode-listing.service';
import { OllamaAdapter } from './infrastructure/ollama.adapter';
import { NominatimAdapter } from './infrastructure/nominatim.adapter';
import { PhotonAdapter } from './infrastructure/photon.adapter';
import { GeocodingAdapter } from './infrastructure/geocoding.adapter';

@Module({
  providers: [
    RuleScorerService,
    OllamaAdapter,
    NominatimAdapter,
    PhotonAdapter,
    GeocodingAdapter,
    GeocodeListingService,
    ScoreListingsUseCase,
  ],
  exports: [ScoreListingsUseCase],
})
export class ScoringModule {}
