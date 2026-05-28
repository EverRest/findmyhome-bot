export interface ZoneDefinition {
  name: string;
  aliases: string[];
}

export interface LlmRatingCriterion {
  key: string;
  label: string;
  description?: string;
}

export interface LlmRatingReference {
  cityCenter?: string;
  piazzaRivoli?: string;
  preferredMetro?: string | string[];
  targetZones?: string;
}

export interface LlmRatingConfig {
  /** Main prompt; supports {{listingJson}}, {{hardCriteria}}, {{criteriaKeys}} */
  prompt: string;
  criteria: LlmRatingCriterion[];
  reference?: LlmRatingReference;
}

export interface TelegramAiSuggestionConfig {
  /** Instructions for the LLM "summary" field (one sentence in Telegram). */
  prompt: string;
}

export interface TelegramConfig {
  aiSuggestion?: TelegramAiSuggestionConfig;
  /** Do not ingest or send listings with rent above this (default 800). */
  digestMaxRentEur?: number;
}

export interface SearchCriteria {
  notes: string;
  locale: string;
  telegram?: TelegramConfig;
  hard: {
    roomsMin?: number;
    roomsMax?: number;
    areaMinSqm?: number;
    areaMaxSqm?: number;
    rentMinEur?: number;
    rentMaxEur?: number;
    totalCostMaxEur?: number;
    zones?: ZoneDefinition[];
    zoneMatchMode?: 'fuzzy' | 'exact';
    metroStations?: string[];
    metroMatchMode?: 'fuzzy' | 'exact';
  };
  soft: {
    mustHave?: string[];
    niceToHave?: string[];
    avoid?: string[];
  };
  scoring: {
    llmWeight: number;
    rulesWeight: number;
    zoneMissPenalty?: number;
    referencePoint?: {
      name: string;
      lat: number;
      lng: number;
    };
    geocoding?: {
      enabled?: boolean;
      provider?: 'nominatim';
      baseUrl?: string;
      minIntervalMs?: number;
      fallbackProvider?: 'photon';
      photonBaseUrl?: string;
      citySuffix?: string;
    };
    distanceScore?: {
      buckets: { maxM: number; score: number }[];
      missingScore?: number;
    };
    rulesProximityBonus?: number;
  };
  llmRating?: LlmRatingConfig;
}
