import type { ParsedFile, Cell } from './parser';

export type DiffType = 'added' | 'removed' | 'changed' | 'formula-changed';

export interface CellDiff {
  type: DiffType;
  sheet: string;
  row: number;
  col: number;
  oldValue?: unknown;
  newValue?: unknown;
  oldFormula?: string;
  newFormula?: string;
  oldFormatted?: string;
  newFormatted?: string;
}

export interface DiffResult {
  diffs: CellDiff[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    formulaChanged: number;
  };
}

function cellKey(cell: Cell): string {
  return `${cell.row}:${cell.col}`;
}

export function diffFiles(oldFile: ParsedFile, newFile: ParsedFile): DiffResult {
  const diffs: CellDiff[] = [];
  
  const allSheets = new Set([
    ...oldFile.sheets.map(s => s.name),
    ...newFile.sheets.map(s => s.name),
  ]);
  
  allSheets.forEach(sheetName => {
    const oldSheet = oldFile.sheets.find(s => s.name === sheetName);
    const newSheet = newFile.sheets.find(s => s.name === sheetName);
    
    if (!oldSheet && newSheet) {
      newSheet.cells.forEach(cell => {
        diffs.push({
          type: 'added',
          sheet: sheetName,
          row: cell.row,
          col: cell.col,
          newValue: cell.value,
          newFormula: cell.formula,
          newFormatted: cell.formattedValue,
        });
      });
      return;
    }
    
    if (oldSheet && !newSheet) {
      oldSheet.cells.forEach(cell => {
        diffs.push({
          type: 'removed',
          sheet: sheetName,
          row: cell.row,
          col: cell.col,
          oldValue: cell.value,
          oldFormula: cell.formula,
          oldFormatted: cell.formattedValue,
        });
      });
      return;
    }
    
    if (!oldSheet || !newSheet) return;
    
    const oldCellsMap = new Map<string, Cell>();
    oldSheet.cells.forEach(c => oldCellsMap.set(cellKey(c), c));
    
    const newCellsMap = new Map<string, Cell>();
    newSheet.cells.forEach(c => newCellsMap.set(cellKey(c), c));
    
    const allKeys = new Set([...oldCellsMap.keys(), ...newCellsMap.keys()]);
    
    allKeys.forEach(key => {
      const oldCell = oldCellsMap.get(key);
      const newCell = newCellsMap.get(key);
      
      if (!oldCell && newCell) {
        diffs.push({
          type: 'added',
          sheet: sheetName,
          row: newCell.row,
          col: newCell.col,
          newValue: newCell.value,
          newFormula: newCell.formula,
          newFormatted: newCell.formattedValue,
        });
      } else if (oldCell && !newCell) {
        diffs.push({
          type: 'removed',
          sheet: sheetName,
          row: oldCell.row,
          col: oldCell.col,
          oldValue: oldCell.value,
          oldFormula: oldCell.formula,
          oldFormatted: oldCell.formattedValue,
        });
      } else if (oldCell && newCell) {
        const valueChanged = JSON.stringify(oldCell.value) !== JSON.stringify(newCell.value);
        const formulaChanged = oldCell.formula !== newCell.formula;
        
        if (formulaChanged) {
          diffs.push({
            type: 'formula-changed',
            sheet: sheetName,
            row: oldCell.row,
            col: oldCell.col,
            oldValue: oldCell.value,
            newValue: newCell.value,
            oldFormula: oldCell.formula,
            newFormula: newCell.formula,
            oldFormatted: oldCell.formattedValue,
            newFormatted: newCell.formattedValue,
          });
        } else if (valueChanged) {
          diffs.push({
            type: 'changed',
            sheet: sheetName,
            row: oldCell.row,
            col: oldCell.col,
            oldValue: oldCell.value,
            newValue: newCell.value,
            oldFormula: oldCell.formula,
            newFormula: newCell.formula,
            oldFormatted: oldCell.formattedValue,
            newFormatted: newCell.formattedValue,
          });
        }
      }
    });
  });
  
  const summary = {
    added: diffs.filter(d => d.type === 'added').length,
    removed: diffs.filter(d => d.type === 'removed').length,
    changed: diffs.filter(d => d.type === 'changed').length,
    formulaChanged: diffs.filter(d => d.type === 'formula-changed').length,
  };
  
  return { diffs, summary };
}

export function formatDiffForDisplay(diff: CellDiff): string {
  const colLetter = indexToColumn(diff.col);
  const cellRef = `${colLetter}${diff.row + 1}`;
  
  switch (diff.type) {
    case 'added':
      return `+ ${cellRef}: ${diff.newFormatted || diff.newValue}`;
    case 'removed':
      return `- ${cellRef}: ${diff.oldFormatted || diff.oldValue}`;
    case 'changed':
      return `~ ${cellRef}: "${diff.oldFormatted || diff.oldValue}" → "${diff.newFormatted || diff.newValue}"`;
    case 'formula-changed':
      return `~ ${cellRef} (formula): "${diff.oldFormula}" → "${diff.newFormula}"`;
  }
}

function indexToColumn(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}