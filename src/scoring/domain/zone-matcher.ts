export interface ZoneDefinition {
  name: string;
  aliases: string[];
}

export interface ZoneMatchResult {
  matched: boolean;
  matchedZones: string[];
}

export function matchZones(
  text: string,
  zones: ZoneDefinition[],
): ZoneMatchResult {
  const normalized = text.toLowerCase();
  const matchedZones: string[] = [];

  for (const zone of zones) {
    const terms = [zone.name, ...zone.aliases].map((t) => t.toLowerCase());
    if (terms.some((t) => normalized.includes(t))) {
      matchedZones.push(zone.name);
    }
  }

  return {
    matched: matchedZones.length > 0,
    matchedZones: [...new Set(matchedZones)],
  };
}
