import type { ParsedFile, Cell } from '../parser';
import type { Finding, Severity } from './types';
import { createFinding } from './types';

function inferType(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return 'number-as-text';
    if (/^\d*\.\d+$/.test(trimmed)) return 'number-as-text';
    if (/^true$/i.test(trimmed) || /^false$/i.test(trimmed)) return 'boolean-as-text';
    if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(trimmed)) return 'date-as-text';
    return 'text';
  }
  if (value instanceof Date) return 'date';
  return 'unknown';
}

export function runDataQualityChecks(parsed: ParsedFile): Finding[] {
  const findings: Finding[] = [];
  
  parsed.sheets.forEach(sheet => {
    const colCount = sheet.colCount;
    const rowCount = sheet.rowCount;
    
    for (let col = 0; col < colCount; col++) {
      const colCells = sheet.cells.filter(c => c.col === col);
      if (colCells.length === 0) continue;
      
      const types = colCells.map(c => inferType(c.value));
      const nonEmptyTypes = types.filter(t => t !== 'empty');
      const uniqueTypes = [...new Set(nonEmptyTypes)];
      
      if (uniqueTypes.length > 1) {
        const typeCounts = uniqueTypes.map(t => ({
          type: t,
          count: nonEmptyTypes.filter(nt => nt === t).length,
        })).sort((a, b) => b.count - a.count);
        
        findings.push(createFinding(
          'high',
          'data',
          'Mixed Data Types in Column',
          `Column ${col + 1} contains mixed types: ${typeCounts.map(tc => `${tc.type} (${tc.count})`).join(', ')}`,
          sheet.name,
          { col, affectedCells: nonEmptyTypes.length, suggestion: 'Standardize data types in this column' }
        ));
      }
      
      const numberAsTextCount = types.filter(t => t === 'number-as-text').length;
      if (numberAsTextCount > 0 && numberAsTextCount / nonEmptyTypes.length > 0.5) {
        findings.push(createFinding(
          'medium',
          'data',
          'Numbers Stored as Text',
          `Column ${col + 1} has ${numberAsTextCount} numbers stored as text (${Math.round(numberAsTextCount / nonEmptyTypes.length * 100)}%)`,
          sheet.name,
          { col, affectedCells: numberAsTextCount, suggestion: 'Convert text to numbers using Data > Text to Columns or VALUE() function' }
        ));
      }
      
      const values = colCells.map(c => c.value?.toString().trim()).filter(Boolean);
      const uniqueValues = new Set(values);
      if (values.length !== uniqueValues.size) {
        const duplicates = values.length - uniqueValues.size;
        findings.push(createFinding(
          'high',
          'data',
          'Duplicate Values in Column',
          `Column ${col + 1} contains ${duplicates} duplicate value(s)`,
          sheet.name,
          { col, affectedCells: duplicates, suggestion: 'Remove duplicates or verify if intentional' }
        ));
      }
      
      const whitespaceIssues = colCells.filter(c => {
        const str = String(c.value || '');
        return str !== str.trim() || /\s{2,}/.test(str);
      }).length;
      
      if (whitespaceIssues > 0) {
        findings.push(createFinding(
          'low',
          'data',
          'Whitespace Anomalies',
          `Column ${col + 1} has ${whitespaceIssues} cell(s) with leading/trailing/multiple spaces`,
          sheet.name,
          { col, affectedCells: whitespaceIssues, suggestion: 'Use TRIM() function to clean whitespace' }
        ));
      }
    }
    
    const emptyCells = sheet.cells.filter(c => !c.value || String(c.value).trim() === '');
    const totalPossibleCells = rowCount * colCount;
    const emptyRatio = emptyCells.length / totalPossibleCells;
    
    if (emptyRatio > 0.5 && totalPossibleCells > 100) {
      findings.push(createFinding(
        'low',
        'data',
        'High Sparsity',
        `Sheet is ${Math.round(emptyRatio * 100)}% empty (${emptyCells.length}/${totalPossibleCells} cells)`,
        sheet.name,
        { affectedCells: emptyCells.length, suggestion: 'Consider removing unused rows/columns' }
      ));
    }
    
    let blankClusterSize = 0;
    let maxBlankCluster = 0;
    for (let row = 0; row < rowCount; row++) {
      const rowHasData = sheet.cells.some(c => c.row === row && c.value && String(c.value).trim() !== '');
      if (!rowHasData) {
        blankClusterSize++;
        maxBlankCluster = Math.max(maxBlankCluster, blankClusterSize);
      } else {
        blankClusterSize = 0;
      }
    }
    
    if (maxBlankCluster > 10) {
      findings.push(createFinding(
        'low',
        'data',
        'Large Blank Row Cluster',
        `Found ${maxBlankCluster} consecutive blank rows`,
        sheet.name,
        { suggestion: 'Remove unnecessary blank rows' }
      ));
    }
  });
  
  return findings;
}