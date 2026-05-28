export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export const RISK_ORDER: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};
