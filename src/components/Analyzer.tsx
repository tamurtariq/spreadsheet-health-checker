import { useState } from 'react';
import FileUpload from './FileUpload';
import HealthReport from './HealthReport';
import type { ParsedFile } from '../lib/parser';
import type { HealthReport as HealthReportType } from '../lib/checks/types';

interface AnalyzerProps {}

export default function Analyzer() {
  const [report, setReport] = useState<{ parsed: ParsedFile; report: HealthReportType } | null>(null);

  const handleAnalyzeComplete = (parsed: ParsedFile, healthReport: HealthReportType) => {
    setReport({ parsed, report: healthReport });
  };

  const handleNewAnalysis = () => {
    setReport(null);
  };

  return (
    <div className="analyzer-container">
      {report ? (
        <HealthReport 
          report={report.report} 
          onNewAnalysis={handleNewAnalysis} 
        />
      ) : (
        <FileUpload onAnalyzeComplete={handleAnalyzeComplete} />
      )}
    </div>
  );
}