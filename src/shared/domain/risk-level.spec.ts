import { RISK_ORDER, type RiskLevel } from './risk-level';

describe('risk-level', () => {
  it('orders risk levels', () => {
    const levels: RiskLevel[] = ['high', 'none', 'medium', 'low'];
    levels.sort((a, b) => RISK_ORDER[a] - RISK_ORDER[b]);
    expect(levels[0]).toBe('none');
    expect(levels[levels.length - 1]).toBe('high');
  });
});
