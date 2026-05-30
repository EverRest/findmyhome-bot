import { NominatimAdapter } from './nominatim.adapter';

describe('NominatimAdapter', () => {
  const config = { get: jest.fn() };
  const log = {
    create: jest.fn(() => ({
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns null when User-Agent missing', async () => {
    config.get.mockReturnValue(undefined);
    const adapter = new NominatimAdapter(config as never, log as never);
    expect(await adapter.geocode('Via Roma 1, Torino', {})).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('parses nominatim JSON response', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      return undefined;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '45.079', lon: '7.642' }],
    });
    const adapter = new NominatimAdapter(config as never, log as never);
    const result = await adapter.geocode('Via Prali 2, Torino', {
      minIntervalMs: 0,
    });
    expect(result).toEqual({ lat: 45.079, lng: 7.642 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim'),
      expect.objectContaining({
        headers: { 'User-Agent': 'FindMyHome/1.0 (test@test.com)' },
      }),
    );
  });

  it('returns null on empty results', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      if (key === 'NOMINATIM_BASE_URL')
        return 'https://nominatim.openstreetmap.org';
      return undefined;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    const adapter = new NominatimAdapter(config as never, log as never);
    expect(await adapter.geocode('nowhere', { minIntervalMs: 0 })).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      return 'https://nominatim.openstreetmap.org';
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    const adapter = new NominatimAdapter(config as never, log as never);
    expect(
      await adapter.geocode('Via Roma 1', { minIntervalMs: 0 }),
    ).toBeNull();
  });

  it('returns null on network error', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      return 'https://nominatim.openstreetmap.org';
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    const adapter = new NominatimAdapter(config as never, log as never);
    expect(
      await adapter.geocode('Via Roma 1', { minIntervalMs: 0 }),
    ).toBeNull();
  });

  it('returns null when coordinates are not numeric', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      return 'https://nominatim.openstreetmap.org';
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ lat: 'bad', lon: '7.642' }],
    });
    const adapter = new NominatimAdapter(config as never, log as never);
    expect(
      await adapter.geocode('Via Roma 1', { minIntervalMs: 0 }),
    ).toBeNull();
  });

  it('throttles rapid consecutive requests', async () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string) => {
      if (key === 'NOMINATIM_USER_AGENT')
        return 'FindMyHome/1.0 (test@test.com)';
      return 'https://nominatim.openstreetmap.org';
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '45.079', lon: '7.642' }],
    });
    const adapter = new NominatimAdapter(config as never, log as never);
    const first = adapter.geocode('Via Roma 1', { minIntervalMs: 1000 });
    const second = adapter.geocode('Via Roma 2', { minIntervalMs: 1000 });
    await jest.runAllTimersAsync();
    await Promise.all([first, second]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
