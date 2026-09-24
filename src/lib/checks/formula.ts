import type { ParsedFile, Cell } from '../parser';
import type { Finding, Severity } from './types';
import { createFinding } from './types';

const ERROR_PATTERNS = [
  { pattern: /#REF!/g, title: '#REF! Error', severity: 'critical' as Severity },
  { pattern: /#DIV\/0!/g, title: '#DIV/0! Error', severity: 'critical' as Severity },
  { pattern: /#VALUE!/g, title: '#VALUE! Error', severity: 'critical' as Severity },
  { pattern: /#NAME\?/g, title: '#NAME? Error', severity: 'high' as Severity },
  { pattern: /#N\/A/g, title: '#N/A Error', severity: 'medium' as Severity },
  { pattern: /#NUM!/g, title: '#NUM! Error', severity: 'high' as Severity },
  { pattern: /#NULL!/g, title: '#NULL! Error', severity: 'high' as Severity },
  { pattern: /#CALC!/g, title: '#CALC! Error', severity: 'high' as Severity },
  { pattern: /#SPILL!/g, title: '#SPILL! Error', severity: 'high' as Severity },
];

function detectCircularReferences(cells: Cell[]): Finding[] {
  const findings: Finding[] = [];
  const formulaCells = cells.filter(c => c.formula);
  
  const graph = new Map<string, Set<string>>();
  const cellMap = new Map<string, Cell>();

  formulaCells.forEach(cell => {
    const key = `${cell.row}:${cell.col}`;
    cellMap.set(key, cell);
    
    if (cell.formula) {
      const refs = extractCellReferences(cell.formula);
      graph.set(key, new Set(refs.map(r => `${r.row}:${r.col}`)));
    }
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string, path: string[]): boolean {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).join(' -> ');
      findings.push(createFinding(
        'critical',
        'formula',
        'Circular Reference Detected',
        `Circular reference found: ${cycle}`,
        'Unknown',
        { suggestion: 'Remove or restructure the circular formula chain' }
      ));
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      hasCycle(neighbor, [...path]);
    }

    recursionStack.delete(node);
    return false;
  }

  graph.forEach((_, node) => {
    if (!visited.has(node)) {
      hasCycle(node, []);
    }
  });

  return findings;
}

function extractCellReferences(formula: string): { row: number; col: number }[] {
  const refs: { row: number; col: number }[] = [];
  const pattern = /\$?([A-Z]+)\$?(\d+)/g;
  let match;
  
  while ((match = pattern.exec(formula)) !== null) {
    const col = columnToIndex(match[1]);
    const row = parseInt(match[2], 10) - 1;
    refs.push({ row, col });
  }
  
  return refs;
}

function columnToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function checkInconsistentFormulas(cells: Cell[]): Finding[] {
  const findings: Finding[] = [];
  const formulaCells = cells.filter(c => c.formula);
  
  const rowsWithFormulas = new Map<number, Cell[]>();
  formulaCells.forEach(cell => {
    if (!rowsWithFormulas.has(cell.row)) {
      rowsWithFormulas.set(cell.row, []);
    }
    rowsWithFormulas.get(cell.row)!.push(cell);
  });

  rowsWithFormulas.forEach((rowCells, rowIndex) => {
    if (rowCells.length < 2) return;
    
    const firstFormula = rowCells[0].formula;
    const inconsistent = rowCells.filter(c => c.formula !== firstFormula);
    
    if (inconsistent.length > 0) {
      findings.push(createFinding(
        'medium',
        'formula',
        'Inconsistent Formulas in Row',
        `Row ${rowIndex + 1} has ${inconsistent.length} cells with formulas differing from the first cell`,
        'Unknown',
        { row: rowIndex, affectedCells: inconsistent.length, suggestion: 'Verify formula consistency across the row' }
      ));
    }
  });

  return findings;
}

export function runFormulaChecks(parsed: ParsedFile): Finding[] {
  const findings: Finding[] = [];
  
  parsed.sheets.forEach(sheet => {
    const sheetFindings: Finding[] = [];
    
    sheet.cells.forEach(cell => {
      const formatted = cell.formattedValue || String(cell.value || '');
      
      ERROR_PATTERNS.forEach(({ pattern, title, severity }) => {
        const matches = [...formatted.matchAll(pattern)];
        if (matches.length > 0) {
          sheetFindings.push(createFinding(
            severity,
            'formula',
            title,
            `Cell contains ${matches.length} instance(s) of ${title}`,
            sheet.name,
            { row: cell.row, col: cell.col, suggestion: `Fix the ${title} in this cell` }
          ));
        }
      });

      if (cell.formula) {
        const formula = cell.formula;
        
        if (formula.includes('INDIRECT') || formula.includes('OFFSET')) {
          sheetFindings.push(createFinding(
            'medium',
            'formula',
            'Volatile Function Used',
            `Formula uses volatile function (INDIRECT/OFFSET) which recalculates on every change`,
            sheet.name,
            { row: cell.row, col: cell.col, suggestion: 'Consider replacing with non-volatile alternatives' }
          ));
        }

        if (formula.match(/[A-Z]+\d+:[A-Z]+\d+/)) {
          const rangeMatch = formula.match(/([A-Z]+\d+):([A-Z]+\d+)/);
          if (rangeMatch) {
            const start = rangeMatch[1];
            const end = rangeMatch[2];
            const startCol = columnToIndex(start.match(/[A-Z]+/)?.[0] || '');
            const endCol = columnToIndex(end.match(/[A-Z]+/)?.[0] || '');
            const startRow = parseInt(start.match(/\d+/)?.[0] || '1', 10) - 1;
            const endRow = parseInt(end.match(/\d+/)?.[0] || '1', 10) - 1;
            
            const rangeSize = (endRow - startRow + 1) * (endCol - startCol + 1);
            if (rangeSize > 10000) {
              sheetFindings.push(createFinding(
                'low',
                'formula',
                'Large Range Reference',
                `Formula references a large range (${rangeSize} cells) which may impact performance`,
                sheet.name,
                { row: cell.row, col: cell.col, suggestion: 'Consider using more specific ranges or structured references' }
              ));
            }
          }
        }
      }
    });

    sheetFindings.push(...detectCircularReferences(sheet.cells));
    sheetFindings.push(...checkInconsistentFormulas(sheet.cells));
    sheetFindings.push(...checkCrossSheetReferences(sheet, parsed));
    sheetFindings.push(...checkNamedRanges(sheet, parsed));
    
    findings.push(...sheetFindings);
  });

  return findings;
}