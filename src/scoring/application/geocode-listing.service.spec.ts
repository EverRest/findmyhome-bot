import { GeocodeListingService } from './geocode-listing.service';
import { createPrismaMock } from '../../../test/helpers/prisma-mock';
import { mockCriteriaLoader } from '../../../test/helpers/test-utils';

describe('GeocodeListingService', () => {
  const prisma = createPrismaMock();
  const geocoding = { geocode: jest.fn() };
  const criteria = mockCriteriaLoader();
  const log = {
    create: jest.fn(() => ({ debug: jest.fn(), warn: jest.fn() })),
  };
  const service = new GeocodeListingService(
    prisma as never,
    geocoding as never,
    criteria as never,
    log as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns null proximity when reference point disabled', async () => {
    criteria.get.mockReturnValue({
      scoring: { geocoding: { enabled: false } },
    });
    const r = await service.resolveProximity({
      id: '1',
      lat: null,
      lng: null,
      locationHint: 'Cenisia',
      title: 'Flat',
    });
    expect(r.proximityScore).toBeNull();
    expect(geocoding.geocode).not.toHaveBeenCalled();
  });

  it('uses cache without calling nominatim', async () => {
    criteria.get.mockReturnValue({
      scoring: {
        referencePoint: { name: 'Anchor', lat: 45.08, lng: 7.64 },
        geocoding: { enabled: true, citySuffix: 'Torino, Italy' },
        distanceScore: {
          buckets: [{ maxM: 500, score: 10 }],
          missingScore: 5,
        },
      },
    });
    prisma.geocodeCache.findUnique.mockResolvedValue({
      lat: 45.079,
      lng: 7.642,
    });
    prisma.listing.update.mockResolvedValue({});

    const r = await service.resolveProximity({
      id: '1',
      lat: null,
      lng: null,
      locationHint: 'Via Prali 2, Cenisia',
      title: 'Flat',
    });

    expect(geocoding.geocode).not.toHaveBeenCalled();
    expect(r.distanceM).not.toBeNull();
    expect(r.proximityScore).toBe(10);
  });

  it('computes distance when listing already has coordinates', async () => {
    criteria.get.mockReturnValue({
      scoring: {
        referencePoint: { name: 'Anchor', lat: 45.08, lng: 7.64 },
        geocoding: { enabled: true },
        distanceScore: {
          buckets: [{ maxM: 5000, score: 8 }],
          missingScore: 5,
        },
      },
    });
    prisma.listing.update.mockResolvedValue({});

    const r = await service.resolveProximity({
      id: '2',
      lat: 45.079,
      lng: 7.642,
      locationHint: 'Via Prali',
      title: 'Flat',
    });

    expect(geocoding.geocode).not.toHaveBeenCalled();
    expect(r.distanceM).not.toBeNull();
    expect(r.proximityScore).toBe(8);
  });

  it('returns missing score when geocode query cannot be built', async () => {
    criteria.get.mockReturnValue({
      scoring: {
        referencePoint: { name: 'Anchor', lat: 45.08, lng: 7.64 },
        geocoding: { enabled: true },
        distanceScore: {
          buckets: [{ maxM: 500, score: 10 }],
          missingScore: 5,
        },
      },
    });

    const r = await service.resolveProximity({
      id: '3',
      lat: null,
      lng: null,
      locationHint: null,
      title: 'x',
    });

    expect(geocoding.geocode).not.toHaveBeenCalled();
    expect(r.proximityScore).toBe(5);
    expect(r.distanceM).toBeNull();
  });

  it('calls geocoding on cache miss and stores cache entry', async () => {
    criteria.get.mockReturnValue({
      scoring: {
        referencePoint: { name: 'Anchor', lat: 45.08, lng: 7.64 },
        geocoding: { enabled: true, citySuffix: 'Torino, Italy' },
        distanceScore: {
          buckets: [{ maxM: 5000, score: 9 }],
          missingScore: 5,
        },
      },
    });
    prisma.geocodeCache.findUnique.mockResolvedValue(null);
    geocoding.geocode.mockResolvedValue({
      lat: 45.079,
      lng: 7.642,
      source: 'photon',
    });
    prisma.geocodeCache.create.mockResolvedValue({});
    prisma.listing.update.mockResolvedValue({});

    const r = await service.resolveProximity({
      id: '4',
      lat: null,
      lng: null,
      locationHint: 'Via Prali 2, Cenisia',
      title: 'Flat',
    });

    expect(geocoding.geocode).toHaveBeenCalled();
    expect(prisma.geocodeCache.create).toHaveBeenCalled();
    expect(r.proximityScore).toBe(9);
  });

  it('isProximityEnabled reflects reference point config', () => {
    criteria.get.mockReturnValue({
      scoring: { referencePoint: { name: 'A', lat: 1, lng: 2 } },
    });
    expect(service.isProximityEnabled()).toBe(true);
    criteria.get.mockReturnValue({ scoring: {} });
    expect(service.isProximityEnabled()).toBe(false);
  });
});
