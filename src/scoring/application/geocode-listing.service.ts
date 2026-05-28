import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import {
  buildGeocodeQuery,
  distanceToScore,
  haversineM,
  normalizeGeocodeKey,
} from '../domain/geo.utils';
import { GeocodingAdapter } from '../infrastructure/geocoding.adapter';

export interface ProximityResult {
  lat: number | null;
  lng: number | null;
  geocodeSource: string | null;
  distanceM: number | null;
  proximityScore: number | null;
}

@Injectable()
export class GeocodeListingService {
  private readonly log;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingAdapter,
    private readonly criteria: CriteriaLoaderService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(GeocodeListingService.name);
  }

  isProximityEnabled(): boolean {
    const c = this.criteria.get().scoring;
    return Boolean(c.referencePoint && c.geocoding?.enabled !== false);
  }

  async resolveProximity(listing: {
    id: string;
    lat: number | null;
    lng: number | null;
    locationHint: string | null;
    title: string | null;
  }): Promise<ProximityResult> {
    const scoring = this.criteria.get().scoring;
    const ref = scoring.referencePoint;
    if (!ref || scoring.geocoding?.enabled === false) {
      return {
        lat: listing.lat,
        lng: listing.lng,
        geocodeSource: null,
        distanceM: null,
        proximityScore: null,
      };
    }

    let lat = listing.lat;
    let lng = listing.lng;
    let geocodeSource: string | null = null;

    if (lat == null || lng == null) {
      const geocoded = await this.geocodeListing(
        listing.locationHint,
        listing.title,
      );
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        geocodeSource = geocoded.source;
        await this.prisma.listing.update({
          where: { id: listing.id },
          data: {
            lat,
            lng,
            geocodeSource,
            geocodedAt: new Date(),
          },
        });
      }
    }

    if (lat == null || lng == null) {
      const missingScore = scoring.distanceScore?.missingScore ?? 5;
      return {
        lat: null,
        lng: null,
        geocodeSource,
        distanceM: null,
        proximityScore: missingScore,
      };
    }

    const distanceM = Math.round(
      haversineM({ lat, lng }, { lat: ref.lat, lng: ref.lng }),
    );
    const buckets = scoring.distanceScore?.buckets ?? [];
    const proximityScore = distanceToScore(
      distanceM,
      buckets,
      scoring.distanceScore?.missingScore ?? 5,
    );

    await this.prisma.listing.update({
      where: { id: listing.id },
      data: { distanceToRefM: distanceM, proximityScore },
    });

    return { lat, lng, geocodeSource, distanceM, proximityScore };
  }

  private async geocodeListing(
    locationHint: string | null,
    title: string | null,
  ): Promise<{ lat: number; lng: number; source: string } | null> {
    const scoring = this.criteria.get().scoring;
    const query = buildGeocodeQuery(
      locationHint,
      title,
      scoring.geocoding?.citySuffix,
    );
    if (!query) return null;

    const queryKey = normalizeGeocodeKey(query);
    const cached = await this.prisma.geocodeCache.findUnique({
      where: { queryKey },
    });
    if (cached) {
      return { lat: cached.lat, lng: cached.lng, source: 'cache' };
    }

    const result = await this.geocoding.geocode(query, {
      baseUrl: scoring.geocoding?.baseUrl,
      minIntervalMs: scoring.geocoding?.minIntervalMs,
      fallbackProvider: scoring.geocoding?.fallbackProvider,
      photonBaseUrl: scoring.geocoding?.photonBaseUrl,
    });
    if (!result) return null;

    await this.prisma.geocodeCache.create({
      data: {
        queryKey,
        queryRaw: query,
        lat: result.lat,
        lng: result.lng,
        source: result.source,
      },
    });

    this.log.debug('geocode', 'Resolved address', { query, ...result });
    return { lat: result.lat, lng: result.lng, source: result.source };
  }
}
