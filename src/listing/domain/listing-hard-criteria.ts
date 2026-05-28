import type { SearchCriteria } from '../../shared/infrastructure/criteria.types';

export interface HardCriteriaFields {
  title?: string | null;
  locationHint?: string | null;
  rawSnippet?: string | null;
  rooms?: number | null;
  areaSqm?: number | null;
  rentEur?: number | null;
  condoFeeEur?: number | null;
}

/** Build searchable text for zone / avoid checks. */
export function listingCriteriaText(draft: HardCriteriaFields): string {
  return `${draft.rawSnippet ?? ''} ${draft.locationHint ?? ''} ${draft.title ?? ''}`.toLowerCase();
}

/**
 * Returns reasons why the listing fails hard criteria (empty = ok to persist & score).
 * Unknown numeric fields are not penalized; known values must match ranges in criteria.yaml.
 */
export function getHardCriteriaFailures(
  draft: HardCriteriaFields,
  criteria: SearchCriteria,
): string[] {
  const h = criteria.hard;
  const failures: string[] = [];
  const text = listingCriteriaText(draft);

  for (const phrase of criteria.soft?.avoid ?? []) {
    const p = phrase.toLowerCase().trim();
    if (p && text.includes(p)) {
      failures.push(`avoid: ${phrase}`);
    }
  }

  if (draft.rooms != null) {
    const min = h.roomsMin ?? 0;
    const max = h.roomsMax ?? 99;
    if (draft.rooms < min || draft.rooms > max) {
      failures.push(`${draft.rooms} rooms — out of range (${min}–${max})`);
    }
  }

  if (draft.areaSqm != null) {
    const min = h.areaMinSqm ?? 0;
    const max = h.areaMaxSqm ?? 999;
    if (!(draft.areaSqm > min && draft.areaSqm < max)) {
      failures.push(
        `${draft.areaSqm} m² — out of range (${min}–${max} m², strict)`,
      );
    }
  }

  if (draft.rentEur != null) {
    const min = h.rentMinEur ?? 0;
    const max = h.rentMaxEur ?? 99999;
    if (!(draft.rentEur > min && draft.rentEur < max)) {
      failures.push(`${draft.rentEur}€ — outside budget ${min}–${max}€`);
    }
  }

  const total =
    draft.rentEur != null && draft.condoFeeEur != null
      ? draft.rentEur + draft.condoFeeEur
      : null;
  if (
    total != null &&
    h.totalCostMaxEur != null &&
    draft.condoFeeEur != null &&
    total > h.totalCostMaxEur
  ) {
    failures.push(`total ${total}€ > ${h.totalCostMaxEur}€`);
  }

  // Zone mismatch is no longer a hard reject.
  // It is still reflected in scoring penalties downstream.

  return failures;
}

export function meetsHardCriteria(
  draft: HardCriteriaFields,
  criteria: SearchCriteria,
): boolean {
  return getHardCriteriaFailures(draft, criteria).length === 0;
}
