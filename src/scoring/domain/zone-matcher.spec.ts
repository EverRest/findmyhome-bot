import { matchZones } from './zone-matcher';

describe('matchZones', () => {
  const zones = [
    { name: 'Cenisia', aliases: ['cenisia', 'cit turin'] },
    { name: 'Pozzo Strada', aliases: ['pozzo strada'] },
    { name: 'Piazza Bernini', aliases: ['piazza bernini', 'bernini'] },
  ];

  it('matches Cenisia', () => {
    const r = matchZones('Appartamento in Cenisia, 3 locali', zones);
    expect(r.matched).toBe(true);
    expect(r.matchedZones).toContain('Cenisia');
  });

  it('matches Piazza Bernini', () => {
    const r = matchZones('vicino a Piazza Bernini', zones);
    expect(r.matched).toBe(true);
  });

  it('misses unknown area', () => {
    const r = matchZones('San Salvario centro', zones);
    expect(r.matched).toBe(false);
  });
});
