import { ListingForDigest } from '../../listing/domain/listing.repository.port';
import { resolveListingLink } from '../../listing/domain/resolve-listing-link';
import { formatSourceLine } from '../../listing/domain/listing-source';
import { formatDistanceM } from '../../scoring/domain/geo.utils';

export interface FormatListingCardOptions {
  referencePointName?: string | null;
}

export function formatListingCard(
  item: ListingForDigest,
  options?: FormatListingCardOptions,
): string {
  const lines: string[] = [];
  const risk =
    item.riskLevel === 'high'
      ? '🚨 '
      : item.riskLevel === 'medium' || item.riskLevel === 'low'
        ? '⚠️ '
        : '';

  const title = item.title ?? 'Listing';
  const rooms = item.rooms != null ? `${item.rooms} rooms` : '';
  const area = item.areaSqm != null ? `${item.areaSqm} m²` : '';
  const loc = item.locationHint ?? '';

  lines.push(`${risk}🏠 ${item.score}/100 — ${title}`);
  lines.push([rooms, area, loc].filter(Boolean).join(', '));

  const priceParts: string[] = [];
  if (item.rentEur != null) priceParts.push(`💶 ${item.rentEur} €/mo`);
  if (item.condoFeeEur != null) priceParts.push(`spese ${item.condoFeeEur}€`);
  if (item.totalCostEur != null && item.condoFeeEur != null) {
    priceParts.push(`total ~${item.totalCostEur}€`);
  }
  if (priceParts.length) lines.push(priceParts.join(' · '));

  if (item.distanceToRefM != null && options?.referencePointName?.trim()) {
    lines.push(
      `📍 ${formatDistanceM(item.distanceToRefM)} from ${options.referencePointName.trim()}`,
    );
  }

  if (item.aiSuggestion) {
    lines.push(`💡 ${item.aiSuggestion}`);
  }

  if (item.reasons.length) {
    lines.push(`✅ ${item.reasons.slice(0, 3).join('; ')}`);
  }
  if (item.riskReasons.length) {
    lines.push(`⚠️ ${item.riskReasons.join('; ')}`);
  }
  const sourceLine = formatSourceLine(
    item.source,
    item.listingUrl,
    item.canonicalUrl,
  );
  if (sourceLine) lines.push(sourceLine);
  const link = resolveListingLink(item);
  if (link) {
    lines.push(`🔗 ${link}`);
  } else {
    lines.push(
      '🔗 (link from email — run pipeline/run after updating parsers)',
    );
  }

  return lines.join('\n');
}
