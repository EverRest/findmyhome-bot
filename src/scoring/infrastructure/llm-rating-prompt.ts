import type { SearchCriteria } from '../../shared/infrastructure/criteria.types';
import { LLM_RATING_KEYS } from '../domain/llm-rating.types';
import {
  interpolatePrompt,
  listingPayloadForPrompt,
} from '../domain/llm-rating.parser';
import type { ListingDraft } from '../../listing/domain/listing-draft';

/** YAML may use a comma-separated string or a string array. */
function joinList(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value.join(', ') : value;
}

function hardCriteriaSummary(c: SearchCriteria): string {
  const h = c.hard;
  const zones = h.zones?.map((z) => z.name).join(', ') ?? '—';
  const metro = h.metroStations?.join(', ') ?? '—';
  return [
    `rooms ${h.roomsMin ?? '?'}-${h.roomsMax ?? '?'}`,
    `area ${h.areaMinSqm ?? '?'}-${h.areaMaxSqm ?? '?'} m² (strict: greater than min, less than max)`,
    `rent ${h.rentMinEur ?? '?'}-${h.rentMaxEur ?? '?'} EUR/month (strict)`,
    `preferred zones: ${zones}`,
    `reference metro stations: ${metro}`,
  ].join('; ');
}

function aiSuggestionPrompt(criteria: SearchCriteria): string {
  const custom = criteria.telegram?.aiSuggestion?.prompt?.trim();
  if (custom) return custom;
  return [
    'The JSON "summary" field must be exactly ONE sentence in English (max 30 words).',
    'Give a practical tip for this family: fit, trade-off, or what to check on viewing.',
    'Do not repeat scores, rent, rooms, or m² from the listing.',
  ].join('\n');
}

function criteriaKeysDoc(
  c: SearchCriteria,
  vars: Record<string, string>,
): string {
  const defs = c.llmRating?.criteria ?? [];
  return defs
    .map((d) => {
      const desc = d.description ? interpolatePrompt(d.description, vars) : '';
      return `- ${d.key}: ${d.label}${desc ? ` — ${desc}` : ''}`;
    })
    .join('\n');
}

export function buildLlmRatingPrompt(
  criteria: SearchCriteria,
  draft: ListingDraft,
): string {
  const rating = criteria.llmRating;
  if (!rating?.prompt) {
    throw new Error('criteria.llmRating.prompt is missing');
  }

  const ref = rating.reference;
  const listingJson = JSON.stringify(listingPayloadForPrompt(draft), null, 0);

  const vars: Record<string, string> = {
    listingJson,
    hardCriteria: hardCriteriaSummary(criteria),
    jsonKeys: LLM_RATING_KEYS.join(', '),
    targetZones:
      ref?.targetZones ??
      criteria.hard.zones?.map((z) => z.name).join(', ') ??
      'Torino',
    preferredMetro:
      joinList(ref?.preferredMetro) ??
      joinList(criteria.hard.metroStations) ??
      'Bernini, Rivoli, Monte Grappa',
    locale: criteria.locale ?? 'en',
  };

  return interpolatePrompt(rating.prompt, {
    ...vars,
    criteriaKeys: criteriaKeysDoc(criteria, vars),
    aiSuggestionPrompt: aiSuggestionPrompt(criteria),
  });
}
