import { useCallback, useState } from 'react';
import FileDropZone, { type FileDropZoneProgress } from './FileDropZone';
import LeadCleanerReport from './LeadCleanerReport';
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
  const [state, setState] = useState<CleaningState | null>(null);

  const handleRun = useCallback(async (file: File, setProgress: (progress: FileDropZoneProgress | null) => void) => {
    setProgress({ stage: 'Parsing file...', percent: 20 });
    const parsed = await parseFile(file);

    setProgress({ stage: 'Cleaning records...', percent: 70 });
    const result = cleanFile(parsed);

    setProgress({ stage: 'Complete', percent: 100 });
    setState({ fileName: file.name, parsed, result });
  }, []);

  const handleOverrideRole = useCallback((col: number, role: FieldRole) => {
    setState(prev => {
      if (!prev) return prev;

      const columnOverrides: Record<number, FieldRole> = {};
      prev.result.mappings.forEach(m => {
        columnOverrides[m.col] = m.col === col ? role : m.role;
      });

      const result = cleanFile(prev.parsed, { columnOverrides });
      return { ...prev, result };
    });
  }, []);

  const handleNewCleaning = useCallback(() => setState(null), []);

  return (
    <div className="lead-cleaner-container">
      {state ? (
        <LeadCleanerReport
          result={state.result}
          fileName={state.fileName}
          onOverrideRole={handleOverrideRole}
          onNewCleaning={handleNewCleaning}
        />
      ) : (
        <FileDropZone
          onRun={handleRun}
          actionLabel="Clean My List"
          invalidExtensionMessage="Please upload a CSV or Excel (.xlsx/.xls) file"
        />
      )}
    </div>
  );
}
