import { Injectable } from '@nestjs/common';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { NominatimAdapter } from './nominatim.adapter';
import { PhotonAdapter } from './photon.adapter';
import type { GeocodeHit, GeocodeOptions } from './geocoding.types';

@Injectable()
export class GeocodingAdapter {
  private readonly log;
  private lastRequestAt = 0;

  constructor(
    private readonly nominatim: NominatimAdapter,
    private readonly photon: PhotonAdapter,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(GeocodingAdapter.name);
  }

  async geocode(
    query: string,
    options: GeocodeOptions = {},
  ): Promise<GeocodeHit | null> {
    const minIntervalMs = options.minIntervalMs ?? 1100;
    await this.throttle(minIntervalMs);

    const nominatimResult = await this.nominatim.geocode(query, {
      baseUrl: options.baseUrl,
      minIntervalMs: 0,
    });
    if (nominatimResult) {
      this.log.info('geocode', 'Resolved via Nominatim', { query });
      return { ...nominatimResult, source: 'nominatim' };
    }

    if (options.fallbackProvider !== 'photon') {
      return null;
    }

    this.log.debug('geocode', 'Nominatim miss — trying Photon fallback', {
      query,
    });
    const photonResult = await this.photon.geocode(query, {
      baseUrl: options.photonBaseUrl,
    });
    if (!photonResult) return null;
    this.log.info('geocode', 'Resolved via Photon', { query });
    return { ...photonResult, source: 'photon' };
  }

  private async throttle(minIntervalMs: number): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minIntervalMs) {
      await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
