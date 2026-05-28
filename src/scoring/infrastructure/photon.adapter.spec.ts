import { PhotonAdapter } from './photon.adapter';

describe('PhotonAdapter', () => {
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

  it('parses GeoJSON coordinates as lng,lat', async () => {
    config.get.mockReturnValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: { coordinates: [7.642, 45.079] } }],
      }),
    });
    const adapter = new PhotonAdapter(config as never, log as never);
    const result = await adapter.geocode('Via Prali 2, Torino', {});
    expect(result).toEqual({ lat: 45.079, lng: 7.642 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('photon.komoot.io/api/'),
    );
  });

  it('returns null on empty features', async () => {
    config.get.mockReturnValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    const adapter = new PhotonAdapter(config as never, log as never);
    expect(await adapter.geocode('nowhere', {})).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    config.get.mockReturnValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    const adapter = new PhotonAdapter(config as never, log as never);
    expect(await adapter.geocode('Via Roma 1', {})).toBeNull();
  });

  it('returns null on network error', async () => {
    config.get.mockReturnValue(undefined);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    const adapter = new PhotonAdapter(config as never, log as never);
    expect(await adapter.geocode('Via Roma 1', {})).toBeNull();
  });
});
