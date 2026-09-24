import FileDropZone, { type FileDropZoneProgress } from './FileDropZone';
import { parseFile } from '../lib/parser';
import { analyzeFile } from '../lib/engine';
import type { ParsedFile } from '../lib/parser';
import type { HealthReport as HealthReportType } from '../lib/checks/types';

interface FileUploadProps {
  onAnalyzeComplete: (parsed: ParsedFile, report: HealthReportType) => void;
  maxFileSize?: number;
}

export default function FileUpload({ onAnalyzeComplete, maxFileSize = 50 * 1024 * 1024 }: FileUploadProps) {
  const handleRun = async (
    file: File,
    setProgress: (progress: FileDropZoneProgress | null) => void
  ) => {
    setProgress({ stage: 'Parsing file...', percent: 10 });
    const parsed = await parseFile(file);

    setProgress({ stage: 'Running health checks...', percent: 50 });
    const report = await analyzeFile(parsed);

    setProgress({ stage: 'Complete', percent: 100 });
    onAnalyzeComplete(parsed, report);
  };

  return (
    <FileDropZone
      onRun={handleRun}
      actionLabel="Analyze Spreadsheet"
      maxFileSize={maxFileSize}
      invalidExtensionMessage="Please upload a CSV or Excel (.xlsx/.xls) file"
    />
  );
}
