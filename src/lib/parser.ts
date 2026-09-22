import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface Cell {
  row: number;
  col: number;
  value: unknown;
  formula?: string;
  formattedValue?: string;
}

export interface SheetData {
  name: string;
  cells: Cell[];
  rowCount: number;
  colCount: number;
}

export interface ParsedFile {
  fileName: string;
  sheets: SheetData[];
  fileType: 'csv' | 'xlsx';
  parsedAt: Date;
}

function columnToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function parseCellAddress(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell address: ${address}`);
  return { col: columnToIndex(match[1]), row: parseInt(match[2], 10) - 1 };
}

export async function parseCSV(file: File, useWorker = true): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      worker: useWorker,
      complete: (results) => {
        const data = results.data as unknown[][];
        const cells: Cell[] = [];
        
        data.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            if (value !== null && value !== undefined && value !== '') {
              cells.push({
                row: rowIndex,
                col: colIndex,
                value,
                formattedValue: String(value),
              });
            }
          });
        });

        resolve({
          fileName: file.name,
          fileType: 'csv',
          parsedAt: new Date(),
          sheets: [{
            name: 'Sheet1',
            cells,
            rowCount: data.length,
            colCount: data[0]?.length || 0,
          }],
        });
      },
      error: (error) => reject(error),
    });
  });
}

export async function parseXLSX(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array', 
    cellFormula: true,
    cellText: true,
    cellDates: true,
  });

  const sheets: SheetData[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const cells: Cell[] = [];
    let maxRow = 0;
    let maxCol = 0;

    Object.keys(worksheet).forEach((key) => {
      if (key[0] === '!') return;
      
      const { row, col } = parseCellAddress(key);
      const cell = worksheet[key];
      
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);

      if (cell.v !== null && cell.v !== undefined && cell.v !== '') {
        cells.push({
          row,
          col,
          value: cell.v,
          formula: cell.f,
          formattedValue: cell.w || String(cell.v),
        });
      }
    });

    sheets.push({
      name: sheetName,
      cells,
      rowCount: maxRow + 1,
      colCount: maxCol + 1,
    });
  });

  return {
    fileName: file.name,
    fileType: 'xlsx',
    parsedAt: new Date(),
    sheets,
  };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseXLSX(file);
  } else {
    throw new Error(`Unsupported file type: ${extension}. Please upload CSV or XLSX files.`);
  }
}

export function getColumnValues(parsed: ParsedFile, sheetName: string, colIndex: number): unknown[] {
  const sheet = parsed.sheets.find(s => s.name === sheetName);
  if (!sheet) return [];
  
  return sheet.cells
    .filter(c => c.col === colIndex)
    .sort((a, b) => a.row - b.row)
    .map(c => c.value);
}

export function getRowValues(parsed: ParsedFile, sheetName: string, rowIndex: number): unknown[] {
  const sheet = parsed.sheets.find(s => s.name === sheetName);
  if (!sheet) return [];
  
  return sheet.cells
    .filter(c => c.row === rowIndex)
    .sort((a, b) => a.col - b.col)
    .map(c => c.value);
}