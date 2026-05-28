import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import type { GeocodeResult } from './geocoding.types';

@Injectable()
export class PhotonAdapter {
  private readonly log;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(PhotonAdapter.name);
  }

  async geocode(
    query: string,
    options: { baseUrl?: string },
  ): Promise<GeocodeResult | null> {
    const baseUrl =
      this.config.get<string>('PHOTON_BASE_URL') ??
      options.baseUrl ??
      'https://photon.komoot.io';

    const url = new URL('/api/', baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        this.log.warn('geocode', 'Photon HTTP error', {
          status: res.status,
          query,
        });
        return null;
      }
      const body = (await res.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
        }>;
      };
      const coords = body.features?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (err) {
      this.log.warn('geocode', 'Photon request failed', {
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
