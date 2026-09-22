import type { ParsedFile } from '../parser';
import type { Finding, Severity } from './types';
import { createFinding } from './types';

export function runStructureChecks(parsed: ParsedFile): Finding[] {
  const findings: Finding[] = [];
  
  parsed.sheets.forEach(sheet => {
    if (sheet.rowCount > 10000) {
      findings.push(createFinding(
        'low',
        'structure',
        'Very Large Sheet',
        `Sheet has ${sheet.rowCount} rows, which may impact performance`,
        sheet.name,
        { suggestion: 'Consider splitting into multiple sheets or using a database' }
      ));
    }
    
    if (sheet.colCount > 200) {
      findings.push(createFinding(
        'low',
        'structure',
        'Wide Sheet',
        `Sheet has ${sheet.colCount} columns`,
        sheet.name,
        { suggestion: 'Consider normalizing data structure' }
      ));
    }
    
    const firstRowHasData = sheet.cells.some(c => c.row === 0);
    const firstColHasData = sheet.cells.some(c => c.col === 0);
    
    if (!firstRowHasData && sheet.rowCount > 1) {
      findings.push(createFinding(
        'low',
        'structure',
        'Empty Header Row',
        'First row appears to be empty',
        sheet.name,
        { row: 0, suggestion: 'Verify if first row should contain headers' }
      ));
    }
    
    const lastRow = sheet.rowCount - 1;
    const lastRowHasData = sheet.cells.some(c => c.row === lastRow);
    if (!lastRowHasData && sheet.rowCount > 1) {
      findings.push(createFinding(
        'low',
        'structure',
        'Trailing Empty Rows',
        `Last ${sheet.rowCount - sheet.cells.reduce((max, c) => Math.max(max, c.row), 0) - 1} row(s) appear empty`,
        sheet.name,
        { suggestion: 'Delete trailing empty rows' }
      ));
    }
    
    const usedCols = new Set(sheet.cells.map(c => c.col));
    const maxCol = sheet.colCount - 1;
    const trailingEmptyCols = Array.from({ length: maxCol + 1 }, (_, i) => i)
      .filter(i => !usedCols.has(i) && i > Math.max(...usedCols))
      .length;
    
    if (trailingEmptyCols > 5) {
      findings.push(createFinding(
        'low',
        'structure',
        'Trailing Empty Columns',
        `${trailingEmptyCols} trailing column(s) appear unused`,
        sheet.name,
        { suggestion: 'Delete unused trailing columns' }
      ));
    }
  });
  
  return findings;
}