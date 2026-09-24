export interface DedupeResult {
  keepIndices: Set<number>;
  duplicateIndices: number[];
}

/**
 * Generic index-preserving dedup: keeps the first occurrence of each key,
 * marks later occurrences as duplicates. A row whose keyFn returns null
 * (e.g. missing email) is always kept — there's nothing to compare it
 * against.
 */
export function findDuplicates<T>(rows: T[], keyFn: (row: T) => string | null): DedupeResult {
  const seen = new Set<string>();
  const keepIndices = new Set<number>();
  const duplicateIndices: number[] = [];

  rows.forEach((row, i) => {
    const key = keyFn(row);
    if (key === null) {
      keepIndices.add(i);
      return;
    }
    if (seen.has(key)) {
      duplicateIndices.push(i);
    } else {
      seen.add(key);
      keepIndices.add(i);
    }
  });

  return { keepIndices, duplicateIndices };
}
