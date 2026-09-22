export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  severity: Severity;
  category: 'formula' | 'data' | 'structure';
  title: string;
  description: string;
  sheet: string;
  location?: {
    row?: number;
    col?: number;
    range?: string;
  };
  affectedCells?: number;
  suggestion?: string;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface HealthReport {
  fileName: string;
  parsedAt: Date;
  findings: Finding[];
  score: HealthScore;
  summary: {
    totalCells: number;
    totalFormulas: number;
    sheetsAnalyzed: number;
  };
}

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
};

export function calculateScore(findings: Finding[]): HealthScore {
  const breakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let totalPenalty = 0;

  findings.forEach(f => {
    breakdown[f.severity]++;
    totalPenalty += SEVERITY_WEIGHTS[f.severity];
  });

  const score = Math.max(0, 100 - totalPenalty);
  
  let grade: HealthScore['grade'] = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return { score, grade, breakdown };
}

export function createFinding(
  severity: Severity,
  category: Finding['category'],
  title: string,
  description: string,
  sheet: string,
  options?: {
    row?: number;
    col?: number;
    range?: string;
    affectedCells?: number;
    suggestion?: string;
  }
): Finding {
  return {
    id: crypto.randomUUID(),
    severity,
    category,
    title,
    description,
    sheet,
    location: options?.row !== undefined || options?.col !== undefined || options?.range
      ? { row: options?.row, col: options?.col, range: options?.range }
      : undefined,
    affectedCells: options?.affectedCells,
    suggestion: options?.suggestion,
  };
}