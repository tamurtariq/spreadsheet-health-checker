import type { ParsedFile } from './parser';
import type { HealthReport, Finding } from './checks/types';
import { 
  calculateScore,
  runFormulaChecks,
  runDataQualityChecks,
  runStructureChecks,
} from './checks';

export async function analyzeFile(parsed: ParsedFile): Promise<HealthReport> {
  const allFindings: Finding[] = [];
  
  allFindings.push(...runFormulaChecks(parsed));
  allFindings.push(...runDataQualityChecks(parsed));
  allFindings.push(...runStructureChecks(parsed));
  
  const totalCells = parsed.sheets.reduce((sum, s) => sum + s.rowCount * s.colCount, 0);
  const totalFormulas = parsed.sheets.reduce((sum, s) => sum + s.cells.filter(c => c.formula).length, 0);
  
  const score = calculateScore(allFindings);
  
  return {
    fileName: parsed.fileName,
    parsedAt: parsed.parsedAt,
    findings: allFindings,
    score,
    summary: {
      totalCells,
      totalFormulas,
      sheetsAnalyzed: parsed.sheets.length,
    },
  };
}

export function sortFindings(findings: Finding[]): Finding[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function filterFindings(findings: Finding[], options: {
  severity?: Finding['severity'][];
  category?: Finding['category'][];
  sheet?: string;
} = {}): Finding[] {
  return findings.filter(f => {
    if (options.severity && !options.severity.includes(f.severity)) return false;
    if (options.category && !options.category.includes(f.category)) return false;
    if (options.sheet && f.sheet !== options.sheet) return false;
    return true;
  });
}

export function exportFindingsCSV(findings: Finding[]): string {
  const headers = ['Severity', 'Category', 'Title', 'Description', 'Sheet', 'Row', 'Column', 'Suggestion'];
  const rows = findings.map(f => [
    f.severity.toUpperCase(),
    f.category,
    f.title,
    f.description,
    f.sheet,
    f.location?.row !== undefined ? String(f.location.row + 1) : '',
    f.location?.col !== undefined ? String(f.location.col + 1) : '',
    f.suggestion || '',
  ]);
  
  return [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
}