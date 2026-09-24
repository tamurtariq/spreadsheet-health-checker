import { useMemo, useState } from 'react';
import type { CleaningAction, CleaningActionType, CleaningResult, FieldRole } from '../lib/cleaning/types';
import { exportCleanedCSV } from '../lib/cleaningEngine';
import '../styles/components.css';

interface LeadCleanerReportProps {
  result: CleaningResult;
  fileName: string;
  onOverrideRole: (col: number, role: FieldRole) => void;
  onNewCleaning: () => void;
}

const ROLE_LABELS: Record<FieldRole, string> = {
  email: 'Email',
  phone: 'Phone',
  firstName: 'First Name',
  lastName: 'Last Name',
  fullName: 'Full Name',
  company: 'Company',
  other: 'Other (no cleaning)',
};

const ACTION_COLORS: Record<CleaningActionType, { bg: string; border: string; text: string }> = {
  formatted: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  capitalized: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  trimmed: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  'flagged-invalid': { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  'flagged-disposable': { bg: '#fff7ed', border: '#f97316', text: '#9a3412' },
};

const ACTIONS_PREVIEW_LIMIT = 50;

function ActionCard({ action }: { action: CleaningAction }) {
  const colors = ACTION_COLORS[action.type];
  return (
    <div className="finding-card" style={{ borderLeft: `4px solid ${colors.border}`, backgroundColor: colors.bg }}>
      <div className="finding-header">
        <div className="finding-title-row">
          <h4 className="finding-title" style={{ color: colors.text }}>{action.message}</h4>
        </div>
        <div className="finding-meta">
          <span>📍 Row {action.row + 1}</span>
          <span>🏷️ {ROLE_LABELS[action.role]}</span>
        </div>
      </div>
      <div className="finding-content">
        <p className="finding-description">
          <code>{action.before || '(empty)'}</code> → <code>{action.after || '(empty)'}</code>
        </p>
      </div>
    </div>
  );
}

export default function LeadCleanerReport({ result, fileName, onOverrideRole, onNewCleaning }: LeadCleanerReportProps) {
  const [showAllActions, setShowAllActions] = useState(false);

  const visibleActions = useMemo(
    () => (showAllActions ? result.summary.actions : result.summary.actions.slice(0, ACTIONS_PREVIEW_LIMIT)),
    [result.summary.actions, showAllActions]
  );

  const handleDownload = () => {
    const csv = exportCleanedCSV(result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace(/\.[^.]+$/, '')}-cleaned.csv`;
    link.click();
  };

  return (
    <div className="cleaning-report">
      <div className="report-header">
        <div className="report-title-section">
          <h2>Cleaning Report: {fileName}</h2>
        </div>
      </div>

      <div className="report-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-value">{result.summary.totalRows}</span>
            <span className="summary-label">Total Rows</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{result.summary.cleanedRows}</span>
            <span className="summary-label">Rows Cleaned</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{result.summary.duplicatesRemoved}</span>
            <span className="summary-label">Duplicates Removed</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{result.summary.invalidEmails}</span>
            <span className="summary-label">Invalid Emails</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{result.summary.disposableEmails}</span>
            <span className="summary-label">Disposable Emails</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{result.summary.invalidPhones}</span>
            <span className="summary-label">Invalid Phones</span>
          </div>
        </div>
      </div>

      <div className="column-mapping">
        <h3>Column Mapping</h3>
        <p className="column-mapping-hint">
          Detected from your header row. If a column was guessed wrong, correct it here and the cleaning re-runs automatically.
        </p>
        <div className="column-mapping-grid">
          {result.mappings.map(mapping => (
            <div className="column-mapping-item" key={mapping.col}>
              <span className="column-mapping-header">{mapping.header}</span>
              <select
                className="column-mapping-select"
                value={mapping.role}
                onChange={e => onOverrideRole(mapping.col, e.target.value as FieldRole)}
              >
                {(Object.keys(ROLE_LABELS) as FieldRole[]).map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="report-actions">
        <button className="export-btn" onClick={handleDownload}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Cleaned CSV
        </button>
        <button className="new-analysis-btn" onClick={onNewCleaning}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Cleaning
        </button>
      </div>

      <div className="findings-list">
        {result.summary.actions.length === 0 ? (
          <div className="no-findings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3>Nothing to clean</h3>
            <p>Every row already looked good.</p>
          </div>
        ) : (
          <>
            {visibleActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
            {!showAllActions && result.summary.actions.length > ACTIONS_PREVIEW_LIMIT && (
              <button className="show-more-btn" onClick={() => setShowAllActions(true)}>
                Show all {result.summary.actions.length} changes
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
