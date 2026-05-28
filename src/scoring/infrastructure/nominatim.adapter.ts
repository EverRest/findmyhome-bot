import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import type { GeocodeResult } from './geocoding.types';

export type { GeocodeResult };

@Injectable()
export class NominatimAdapter {
  private readonly log;
  private lastRequestAt = 0;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(NominatimAdapter.name);
  }

  async geocode(
    query: string,
    options: { baseUrl?: string; minIntervalMs?: number },
  ): Promise<GeocodeResult | null> {
    const userAgent = this.config.get<string>('NOMINATIM_USER_AGENT');
    if (!userAgent?.trim()) {
      this.log.warn('nominatim', 'NOMINATIM_USER_AGENT not set — skip geocode');
      return null;
    }

    const baseUrl =
      this.config.get<string>('NOMINATIM_BASE_URL') ??
      options.baseUrl ??
      'https://nominatim.openstreetmap.org';
    const minIntervalMs = options.minIntervalMs ?? 1100;
    await this.throttle(minIntervalMs);

    const url = new URL('/search', baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'it');

    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': userAgent },
      });
      if (!res.ok) {
        this.log.warn('nominatim', 'HTTP error', { status: res.status, query });
        return null;
      }
      const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const hit = body[0];
      if (!hit?.lat || !hit.lon) return null;
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (err) {
      this.log.warn('nominatim', 'Request failed', {
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async throttle(minIntervalMs: number): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minIntervalMs) {
      await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
