export type FieldRole =
  | 'email'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'company'
  | 'other';

export interface ColumnMapping {
  col: number;
  header: string;
  role: FieldRole;
}

export type CleaningActionType =
  | 'trimmed'
  | 'capitalized'
  | 'formatted'
  | 'flagged-invalid'
  | 'flagged-disposable';

export interface CleaningAction {
  id: string;
  row: number;
  col: number;
  role: FieldRole;
  type: CleaningActionType;
  before: string;
  after: string;
  message: string;
}

export interface RemovedRow {
  row: number;
  reason: string;
}

export interface CleaningSummary {
  totalRows: number;
  cleanedRows: number;
  duplicatesRemoved: number;
  invalidEmails: number;
  disposableEmails: number;
  invalidPhones: number;
  actions: CleaningAction[];
}

export type CleanedCell = string | number | null;

export interface CleaningResult {
  fileName: string;
  header: string[];
  hasHeaderRow: boolean;
  mappings: ColumnMapping[];
  cleanedRows: CleanedCell[][];
  removedRows: RemovedRow[];
  summary: CleaningSummary;
}
