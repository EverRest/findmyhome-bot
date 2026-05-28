/** URL to show in Telegram / UI — never synthetic alert-* paths without a real link. */
export function resolveListingLink(item: {
  canonicalUrl: string;
  listingUrl?: string | null;
}): string | null {
  if (item.listingUrl?.startsWith('http')) {
    return item.listingUrl;
  }
  if (item.canonicalUrl.includes('/annunci/alert-')) {
    return null;
  }
  if (item.canonicalUrl.startsWith('http')) {
    return item.canonicalUrl;
  }
  return null;
}
