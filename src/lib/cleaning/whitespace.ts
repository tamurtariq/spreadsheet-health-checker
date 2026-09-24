export interface WhitespaceCleanResult {
  value: string;
  changed: boolean;
}

export function cleanWhitespace(raw: string): WhitespaceCleanResult {
  const value = raw
    .replace(/ /g, ' ') // non-breaking space -> regular space
    .trim()
    .replace(/\s+/g, ' ');

  return { value, changed: value !== raw };
}
