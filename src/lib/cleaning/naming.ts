export interface NameCleanResult {
  value: string;
  changed: boolean;
}

/**
 * Title-cases each word. Handles apostrophes/hyphens correctly (e.g.
 * "o'brien" -> "O'Brien", "mary-jane" -> "Mary-Jane") since \b treats them
 * as separators. Known limitation: lowercase name particles (e.g. Dutch
 * "van", "der") get capitalized too — an acceptable v1 tradeoff over
 * building a locale-aware exceptions list.
 */
export function capitalizeWords(raw: string): NameCleanResult {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const value = trimmed.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return { value, changed: value !== raw };
}

/**
 * Strips characters that don't belong in a company name while keeping
 * common punctuation (&, ., ', -) intact, e.g. "Acme, Inc.!!" -> "Acme, Inc."
 */
export function cleanCompanyName(raw: string): NameCleanResult {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const value = trimmed.replace(/[^\w\s&.,'-]/g, '');
  return { value, changed: value !== raw };
}
