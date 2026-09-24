import { useCallback, useState } from 'react';
import FileDropZone, { type FileDropZoneProgress } from './FileDropZone';
import LeadCleanerReport from './LeadCleanerReport';
import { useAuthContext } from '../lib/useAuthContext';
import { parseFile } from '../lib/parser';
import { cleanFile } from '../lib/cleaningEngine';
import type { ParsedFile } from '../lib/parser';
import type { CleaningResult, FieldRole } from '../lib/cleaning/types';

interface CleaningState {
  fileName: string;
  parsed: ParsedFile;
  result: CleaningResult;
}

export default function LeadCleaner() {
  const { limits, scansRemaining, subscription } = useAuthContext();
  const [state, setState] = useState<CleaningState | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  const isPaid = subscription.tier === 'pro' || subscription.tier === 'team';

  const handleRun = useCallback(async (file: File, setProgress: (progress: FileDropZoneProgress | null) => void) => {
    setProgress({ stage: 'Parsing file...', percent: 20 });
    const parsed = await parseFile(file);

    setProgress({ stage: 'Cleaning records...', percent: 70 });
    const result = cleanFile(parsed, { advancedCleaning: isPaid });

    setProgress({ stage: 'Complete', percent: 100 });
    setState({ fileName: file.name, parsed, result });

    // Consumes the shared scan quota decided in Phase 0 - Lead Cleaner draws
    // from the same monthly allowance as the health checker, not its own.
    try {
      const res = await fetch('/api/scans/track', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setLimitError(data.error || 'Scan limit exceeded');
        setState(null);
      }
    } catch (error) {
      console.error('Failed to track scan:', error);
    }
  }, [isPaid]);

  const handleOverrideRole = useCallback((col: number, role: FieldRole) => {
    setState(prev => {
      if (!prev) return prev;

      const columnOverrides: Record<number, FieldRole> = {};
      prev.result.mappings.forEach(m => {
        columnOverrides[m.col] = m.col === col ? role : m.role;
      });

      const result = cleanFile(prev.parsed, { columnOverrides, advancedCleaning: isPaid });
      return { ...prev, result };
    });
  }, [isPaid]);

  const handleNewCleaning = useCallback(() => {
    setState(null);
    setLimitError(null);
  }, []);

  const canScan = limits.scansPerMonth === -1 || scansRemaining > 0;

  return (
    <div className="lead-cleaner-container">
      {limitError && (
        <div className="limit-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{limitError}</span>
          <button onClick={handleNewCleaning} className="dismiss-btn">Dismiss</button>
        </div>
      )}

      {state ? (
        <LeadCleanerReport
          result={state.result}
          fileName={state.fileName}
          isPaid={isPaid}
          onOverrideRole={handleOverrideRole}
          onNewCleaning={handleNewCleaning}
        />
      ) : !canScan ? (
        <div className="limit-reached">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Monthly Scan Limit Reached</h3>
          <p>You've used all {limits.scansPerMonth} scans for this month.</p>
          <p className="reset-info">Resets on the 1st of each month. Health Checker and Lead Cleaner share the same monthly allowance.</p>
          {limits.scansPerMonth !== -1 && (
            <button className="upgrade-btn" onClick={() => alert('Upgrade flow coming soon')}>
              Upgrade to Pro for Unlimited Scans
            </button>
          )}
        </div>
      ) : (
        <FileDropZone
          onRun={handleRun}
          actionLabel="Clean My List"
          maxFileSize={limits.maxFileSizeMB * 1024 * 1024}
          invalidExtensionMessage="Please upload a CSV or Excel (.xlsx/.xls) file"
        />
      )}
    </div>
  );
}
