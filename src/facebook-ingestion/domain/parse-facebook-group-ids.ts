/** Numeric ID or vanity slug from facebook.com/groups/{id}. */
export function parseFacebookGroupIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    if (!isFacebookGroupId(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isFacebookGroupId(id: string): boolean {
  if (/^\d+$/.test(id)) return true;
  return /^[a-zA-Z][\w.-]{2,}$/i.test(id);
}
