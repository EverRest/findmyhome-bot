import { Injectable } from '@nestjs/common';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { RiskLevel } from '../../shared/domain/risk-level';
import { ListingDraft } from '../../listing/domain/listing-draft';
import { ScoreResult } from '../domain/score-result';
import { matchZones } from '../domain/zone-matcher';

@Injectable()
export class RuleScorerService {
  constructor(private readonly criteriaLoader: CriteriaLoaderService) {}

  score(draft: ListingDraft, snippet: string): ScoreResult {
    const c = this.criteriaLoader.get();
    const h = c.hard;
    const text =
      `${snippet} ${draft.locationHint ?? ''} ${draft.title ?? ''}`.toLowerCase();

    let score = 50;
    const reasons: string[] = [];
    const riskReasons: string[] = [];
    let riskLevel: RiskLevel = 'none';

    if (draft.rooms != null) {
      if (
        draft.rooms >= (h.roomsMin ?? 0) &&
        draft.rooms <= (h.roomsMax ?? 99)
      ) {
        score += 15;
        reasons.push(`${draft.rooms} rooms — ok`);
      } else {
        score -= 20;
        reasons.push(`${draft.rooms} rooms — out of range`);
      }
    }

    if (draft.areaSqm != null) {
      const areaMin = h.areaMinSqm ?? 0;
      const areaMax = h.areaMaxSqm ?? 999;
      if (draft.areaSqm > areaMin && draft.areaSqm < areaMax) {
        score += 15;
        reasons.push(`${draft.areaSqm} m² — ok`);
      } else {
        score -= 15;
        reasons.push(
          `${draft.areaSqm} m² — out of range (${areaMin}–${areaMax} m²)`,
        );
      }
    }

    const rent = draft.rentEur;
    const total =
      draft.rentEur != null && draft.condoFeeEur != null
        ? draft.rentEur + draft.condoFeeEur
        : rent;

    if (rent != null) {
      const rentMin = h.rentMinEur ?? 0;
      const rentMax = h.rentMaxEur ?? 99999;
      if (rent > rentMin && rent < rentMax) {
        score += 15;
        reasons.push(`${rent}€ rent — within budget`);
      } else {
        score -= 25;
        reasons.push(`${rent}€ — outside budget ${rentMin}–${rentMax}€`);
      }
    }

    if (
      total != null &&
      h.totalCostMaxEur != null &&
      draft.condoFeeEur != null
    ) {
      if (total <= h.totalCostMaxEur) {
        score += 5;
        reasons.push(`total ${total}€ with spese — ok`);
      } else {
        score -= 15;
        reasons.push(`total ${total}€ > ${h.totalCostMaxEur}€`);
      }
    } else if (rent != null && draft.condoFeeEur == null) {
      reasons.push('⚠️ spese not mentioned in email');
    }

    const zones = h.zones ?? [];
    if (zones.length > 0) {
      const zoneHit = matchZones(text, zones);
      if (zoneHit.matched) {
        score += 25;
        reasons.push(`zone: ${zoneHit.matchedZones.join(', ')}`);
      } else {
        const penalty = c.scoring.zoneMissPenalty ?? 20;
        score -= penalty;
        reasons.push('⚠️ zone not in targets (Cenisia, Pozzo Strada, …)');
      }
    }

    const stations = h.metroStations ?? [];
    const metroHit = stations.some((s) => text.includes(s.toLowerCase()));
    if (metroHit) {
      score += 8;
      reasons.push('near metro/landmark');
    }

    for (const rule of this.riskRules(text, draft)) {
      riskReasons.push(rule);
      riskLevel = 'high';
      score -= 10;
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      reasons,
      riskLevel,
      riskReasons,
      riskSource: riskLevel === 'none' ? 'none' : 'rules',
    };
  }

  private riskRules(text: string, draft: ListingDraft): string[] {
    const flags: string[] = [];
    if (/western union|crypto|wire transfer|pagare prima/i.test(text)) {
      flags.push('suspicious payment');
    }
    if (/solo whatsapp|contatta su telegram/i.test(text)) {
      flags.push('messenger-only contact');
    }
    if (draft.rentEur != null && draft.rentEur < 400) {
      flags.push('anomalously low price');
    }
    return flags;
  }
}
