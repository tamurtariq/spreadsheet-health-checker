import type { SheetData } from '../parser';
import type { ColumnMapping, FieldRole } from './types';

const ROLE_PATTERNS: { role: FieldRole; pattern: RegExp }[] = [
  { role: 'email', pattern: /e[-_ ]?mail/i },
  { role: 'phone', pattern: /phone|mobile|cell|tel(ephone)?/i },
  { role: 'firstName', pattern: /first[-_ ]?name|given[-_ ]?name/i },
  { role: 'lastName', pattern: /last[-_ ]?name|sur[-_ ]?name|family[-_ ]?name/i },
  { role: 'fullName', pattern: /^name$|full[-_ ]?name|contact[-_ ]?name/i },
  { role: 'company', pattern: /compan(y|ies)|organi[sz]ation|employer/i },
];

/**
 * Reads the first row as a candidate header. Returns null when the row looks
 * like data (mostly numeric, or too sparse) rather than column names, so the
 * caller can fall back to generic column labels instead of misreading data
 * as headers.
 */
export function detectHeaderRow(sheet: SheetData): string[] | null {
  if (sheet.colCount === 0) return null;

  const firstRowCells = sheet.cells.filter(c => c.row === 0);
  if (firstRowCells.length === 0) return null;

  const values: string[] = [];
  for (let col = 0; col < sheet.colCount; col++) {
    const cell = firstRowCells.find(c => c.col === col);
    values.push(cell ? String(cell.value).trim() : '');
  }

  const nonEmpty = values.filter(v => v !== '');
  if (nonEmpty.length < values.length * 0.5) return null;

  const numericLooking = nonEmpty.filter(v => /^-?\d+(\.\d+)?$/.test(v));
  if (numericLooking.length > nonEmpty.length * 0.3) return null;

  return values;
}

/**
 * Header-name matching only — no fuzzy/statistical guessing over cell values.
 * A wrong guess here is cheap to fix (manual override in the UI); a wrong
 * guess from sniffing data values is not, since it fails silently.
 */
export function classifyColumns(header: string[]): ColumnMapping[] {
  return header.map((rawHeader, col) => {
    const match = ROLE_PATTERNS.find(({ pattern }) => pattern.test(rawHeader));
    return { col, header: rawHeader, role: match?.role ?? 'other' };
  });
}
