import { GeocodingAdapter } from './geocoding.adapter';

describe('GeocodingAdapter', () => {
  const nominatim = { geocode: jest.fn() };
  const photon = { geocode: jest.fn() };
  const log = {
    create: jest.fn(() => ({
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns nominatim result when available', async () => {
    nominatim.geocode.mockResolvedValue({ lat: 45.079, lng: 7.642 });
    const adapter = new GeocodingAdapter(
      nominatim as never,
      photon as never,
      log as never,
    );
    const result = await adapter.geocode('Via Prali 2, Torino', {
      minIntervalMs: 0,
      fallbackProvider: 'photon',
    });
    expect(result).toEqual({
      lat: 45.079,
      lng: 7.642,
      source: 'nominatim',
    });
    expect(photon.geocode).not.toHaveBeenCalled();
  });

  it('falls back to photon when nominatim misses', async () => {
    nominatim.geocode.mockResolvedValue(null);
    photon.geocode.mockResolvedValue({ lat: 45.026, lng: 7.646 });
    const adapter = new GeocodingAdapter(
      nominatim as never,
      photon as never,
      log as never,
    );
    const result = await adapter.geocode('Via Passo Buole 141, Torino', {
      minIntervalMs: 0,
      fallbackProvider: 'photon',
    });
    expect(result).toEqual({
      lat: 45.026,
      lng: 7.646,
      source: 'photon',
    });
    expect(photon.geocode).toHaveBeenCalled();
  });

  it('returns null when both providers miss', async () => {
    nominatim.geocode.mockResolvedValue(null);
    photon.geocode.mockResolvedValue(null);
    const adapter = new GeocodingAdapter(
      nominatim as never,
      photon as never,
      log as never,
    );
    expect(
      await adapter.geocode('nowhere', {
        minIntervalMs: 0,
        fallbackProvider: 'photon',
      }),
    ).toBeNull();
  });

  it('skips photon when fallback disabled', async () => {
    nominatim.geocode.mockResolvedValue(null);
    const adapter = new GeocodingAdapter(
      nominatim as never,
      photon as never,
      log as never,
    );
    expect(
      await adapter.geocode('Via Roma 1', { minIntervalMs: 0 }),
    ).toBeNull();
    expect(photon.geocode).not.toHaveBeenCalled();
  });

  it('waits between requests when throttle interval not elapsed', async () => {
    jest.useFakeTimers();
    nominatim.geocode.mockResolvedValue({ lat: 45.079, lng: 7.642 });
    const adapter = new GeocodingAdapter(
      nominatim as never,
      photon as never,
      log as never,
    );

    const first = adapter.geocode('Via Roma 1', { minIntervalMs: 1000 });
    jest.advanceTimersByTime(200);
    const second = adapter.geocode('Via Roma 2', { minIntervalMs: 1000 });

    await first;
    expect(nominatim.geocode).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(800);
    await second;
    expect(nominatim.geocode).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
