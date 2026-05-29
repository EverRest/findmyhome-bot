export interface ListingDuplicateRow {
  id: string;
  firstSeenAt: Date;
  possibleDuplicateOfId: string | null;
}

/** Oldest listing is primary; newer rows point to it. */
export function assignPossibleDuplicateLinks(
  rows: ListingDuplicateRow[],
): Map<string, string | null> {
  const updates = new Map<string, string | null>();
  if (rows.length <= 1) {
    for (const row of rows) updates.set(row.id, null);
    return updates;
  }

  const sorted = [...rows].sort(
    (a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime(),
  );
  const primaryId = sorted[0].id;
  for (const row of sorted) {
    updates.set(row.id, row.id === primaryId ? null : primaryId);
  }
  return updates;
}
