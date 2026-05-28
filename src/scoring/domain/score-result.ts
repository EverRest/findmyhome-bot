import { RiskLevel } from '../../shared/domain/risk-level';

export interface ScoreResult {
  score: number;
  reasons: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
  riskSource: 'rules' | 'llm' | 'both' | 'none';
  model?: string;
}
