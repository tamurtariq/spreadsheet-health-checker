import Papa from 'papaparse';
import type { ParsedFile, Cell } from './parser';
import { detectHeaderRow, classifyColumns } from './cleaning/columns';
import { cleanEmail } from './cleaning/email';
import { cleanPhone } from './cleaning/phone';
import { cleanWhitespace } from './cleaning/whitespace';
import { capitalizeWords, cleanCompanyName } from './cleaning/naming';
import { findDuplicates } from './cleaning/dedupe';
import type {
  CleaningAction,
  CleaningActionType,
  CleaningResult,
  CleanedCell,
  ColumnMapping,
  FieldRole,
  RemovedRow,
} from './cleaning/types';

export interface CleaningOptions {
  /** Default true. Only applies when an email column was found. */
  removeDuplicateEmails?: boolean;
  /** Manual role override by column index, for when auto-detection guesses wrong. */
  columnOverrides?: Record<number, FieldRole>;
}

function buildCellIndex(cells: Cell[]): Map<string, Cell> {
  const index = new Map<string, Cell>();
  for (const cell of cells) {
    index.set(`${cell.row}:${cell.col}`, cell);
  }
  return index;
}

function isBlankRow(values: unknown[]): boolean {
  return values.every(v => v === undefined || v === null || String(v).trim() === '');
}

export function cleanFile(parsed: ParsedFile, options: CleaningOptions = {}): CleaningResult {
  const sheet = parsed.sheets[0];
  if (!sheet) {
    return {
      fileName: parsed.fileName,
      header: [],
      hasHeaderRow: false,
      mappings: [],
      cleanedRows: [],
      removedRows: [],
      summary: {
        totalRows: 0,
        cleanedRows: 0,
        duplicatesRemoved: 0,
        invalidEmails: 0,
        disposableEmails: 0,
        invalidPhones: 0,
        actions: [],
      },
    };
  }

  const detectedHeader = detectHeaderRow(sheet);
  const hasHeaderRow = detectedHeader !== null;
  const header = detectedHeader ?? Array.from({ length: sheet.colCount }, (_, i) => `Column ${i + 1}`);

  let mappings = classifyColumns(header);
  if (options.columnOverrides) {
    mappings = mappings.map(m =>
      options.columnOverrides![m.col] ? { ...m, role: options.columnOverrides![m.col] } : m
    );
  }

  const cellIndex = buildCellIndex(sheet.cells);
  const dataStartRow = hasHeaderRow ? 1 : 0;

  const actions: CleaningAction[] = [];
  const rowsWithChanges = new Set<number>();
  const cleanedRows: CleanedCell[][] = [];
  const sourceRowForOutputRow: number[] = [];

  for (let row = dataStartRow; row < sheet.rowCount; row++) {
    const rawValues = mappings.map(m => cellIndex.get(`${row}:${m.col}`)?.value);
    if (isBlankRow(rawValues)) continue;

    const outRow: CleanedCell[] = [];

    mappings.forEach((mapping, i) => {
      const raw = rawValues[i];
      outRow.push(cleanCell(raw, mapping, row, actions, rowsWithChanges));
    });

    sourceRowForOutputRow.push(row);
    cleanedRows.push(outRow);
  }

  const emailColIndex = mappings.findIndex(m => m.role === 'email');
  const removeDuplicates = options.removeDuplicateEmails ?? true;
  const removedRows: RemovedRow[] = [];
  let finalRows = cleanedRows;

  if (removeDuplicates && emailColIndex !== -1) {
    const { keepIndices, duplicateIndices } = findDuplicates(cleanedRows, r => {
      const email = r[emailColIndex];
      return typeof email === 'string' && email ? email : null;
    });
    duplicateIndices.forEach(i =>
      removedRows.push({ row: sourceRowForOutputRow[i], reason: 'Duplicate email' })
    );
    finalRows = cleanedRows.filter((_, i) => keepIndices.has(i));
  }

  const invalidEmails = actions.filter(a => a.role === 'email' && a.type === 'flagged-invalid').length;
  const disposableEmails = actions.filter(a => a.role === 'email' && a.type === 'flagged-disposable').length;
  const invalidPhones = actions.filter(a => a.role === 'phone' && a.type === 'flagged-invalid').length;

  return {
    fileName: parsed.fileName,
    header,
    hasHeaderRow,
    mappings,
    cleanedRows: finalRows,
    removedRows,
    summary: {
      totalRows: sourceRowForOutputRow.length,
      cleanedRows: rowsWithChanges.size,
      duplicatesRemoved: removedRows.length,
      invalidEmails,
      disposableEmails,
      invalidPhones,
      actions,
    },
  };
}

function cleanCell(
  raw: unknown,
  mapping: ColumnMapping,
  row: number,
  actions: CleaningAction[],
  rowsWithChanges: Set<number>
): CleanedCell {
  const record = (type: CleaningActionType, before: string, after: string, message: string) => {
    actions.push({
      id: crypto.randomUUID(),
      row,
      col: mapping.col,
      role: mapping.role,
      type,
      before,
      after,
      message,
    });
    if (before !== after) rowsWithChanges.add(row);
  };

  if (mapping.role === 'email') {
    const before = raw === undefined || raw === null ? '' : String(raw);
    const result = cleanEmail(before);
    if (result.changed) record('formatted', before, result.value, 'Normalized email');
    if (!result.valid) record('flagged-invalid', before, result.value, 'Invalid email format');
    if (result.disposable) record('flagged-disposable', before, result.value, 'Disposable email domain');
    return result.value;
  }

  if (mapping.role === 'phone') {
    const before = raw === undefined || raw === null ? '' : String(raw);
    const result = cleanPhone(typeof raw === 'number' ? raw : before);
    if (result.changed) record('formatted', before, result.value, 'Normalized phone number');
    if (!result.valid) record('flagged-invalid', before, result.value, 'Could not normalize to a valid US/Canada number');
    return result.value;
  }

  if (mapping.role === 'firstName' || mapping.role === 'lastName' || mapping.role === 'fullName') {
    const before = raw === undefined || raw === null ? '' : String(raw);
    const result = capitalizeWords(before);
    if (result.changed) record('capitalized', before, result.value, 'Capitalized name');
    return result.value;
  }

  if (mapping.role === 'company') {
    const before = raw === undefined || raw === null ? '' : String(raw);
    const result = cleanCompanyName(before);
    if (result.changed) record('trimmed', before, result.value, 'Cleaned company name');
    return result.value;
  }

  if (typeof raw === 'string') {
    const result = cleanWhitespace(raw);
    if (result.changed) record('trimmed', raw, result.value, 'Trimmed whitespace');
    return result.value;
  }

  return (raw as CleanedCell) ?? null;
}

/**
 * Serializes the cleaned dataset back to a CSV string, preserving the
 * original header row and column order.
 */
export function exportCleanedCSV(result: CleaningResult): string {
  const rows = result.hasHeaderRow ? [result.header, ...result.cleanedRows] : result.cleanedRows;
  return Papa.unparse(rows);
}
