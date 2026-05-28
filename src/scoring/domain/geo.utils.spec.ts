import {
  buildGeocodeQuery,
  distanceToScore,
  formatDistanceM,
  haversineM,
  normalizeGeocodeKey,
} from './geo.utils';

describe('geo.utils', () => {
  const bernini = { lat: 45.080044, lng: 7.6444 };

  it('haversineM returns plausible Turin distance', () => {
    const viaPrali = { lat: 45.079, lng: 7.642 };
    const m = haversineM(viaPrali, bernini);
    expect(m).toBeGreaterThan(100);
    expect(m).toBeLessThan(800);
  });

  it('distanceToScore maps buckets', () => {
    const buckets = [
      { maxM: 500, score: 10 },
      { maxM: 1000, score: 9 },
      { maxM: 4000, score: 3 },
    ];
    expect(distanceToScore(400, buckets)).toBe(10);
    expect(distanceToScore(800, buckets)).toBe(9);
    expect(distanceToScore(5000, buckets)).toBe(0);
    expect(distanceToScore(Number.NaN, buckets, 5)).toBe(5);
  });

  it('buildGeocodeQuery prefers locationHint and appends city', () => {
    expect(
      buildGeocodeQuery('Via Prali, 2, Cenisia', undefined, 'Torino, Italy'),
    ).toBe('Via Prali, 2, Cenisia, Torino, Italy');
    expect(
      buildGeocodeQuery('Cenisia, Torino', undefined, 'Torino, Italy'),
    ).toBe('Cenisia, Torino');
  });

  it('normalizeGeocodeKey collapses whitespace', () => {
    expect(normalizeGeocodeKey('Via  Prali,  2')).toBe('via prali 2');
  });

  it('formatDistanceM', () => {
    expect(formatDistanceM(650)).toBe('~650 m');
    expect(formatDistanceM(1500)).toBe('~1.5 km');
  });
});
