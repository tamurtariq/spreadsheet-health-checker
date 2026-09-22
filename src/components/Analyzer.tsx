import { useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import HealthReport from './HealthReport';
import type { ParsedFile } from '../lib/parser';
import type { HealthReport as HealthReportType } from '../lib/checks/types';

interface TierLimits {
  scansPerMonth: number;
  maxFileSizeMB: number;
  diffChecker: boolean;
  pdfExport: boolean;
  seats: number;
}

interface AnalyzerProps {
  limits: TierLimits;
  scansUsed: number;
  scansRemaining: number;
}

export default function Analyzer({ limits, scansUsed, scansRemaining }: AnalyzerProps) {
  const [report, setReport] = useState<{ parsed: ParsedFile; report: HealthReportType } | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const handleAnalyzeComplete = useCallback(async (parsed: ParsedFile, healthReport: HealthReportType) => {
    setReport({ parsed, report: healthReport });
    
    // Track the scan
    setIsTracking(true);
    try {
      const res = await fetch('/api/scans/track', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const data = await res.json();
        setLimitError(data.error || 'Scan limit exceeded');
        setReport(null);
      }
    } catch (error) {
      console.error('Failed to track scan:', error);
    } finally {
      setIsTracking(false);
    }
  }, []);

  const handleNewAnalysis = () => {
    setReport(null);
    setLimitError(null);
  };

  // Check if user can scan before showing upload
  const canScan = limits.scansPerMonth === -1 || scansRemaining > 0;

  return (
    <div className="analyzer-container">
      {limitError && (
        <div className="limit-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{limitError}</span>
          <button onClick={handleNewAnalysis} className="dismiss-btn">Dismiss</button>
        </div>
      )}
      
      {report ? (
        <HealthReport 
          report={report.report} 
          onNewAnalysis={handleNewAnalysis}
          limits={limits}
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
          <p className="reset-info">Resets on the 1st of each month.</p>
          {limits.scansPerMonth !== -1 && (
            <button className="upgrade-btn" onClick={() => alert('Upgrade flow coming soon')}>
              Upgrade to Pro for Unlimited Scans
            </button>
          )}
        </div>
      ) : (
        <FileUpload 
          onAnalyzeComplete={handleAnalyzeComplete} 
          maxFileSize={limits.maxFileSizeMB * 1024 * 1024}
          scansRemaining={scansRemaining}
          totalScans={limits.scansPerMonth}
        />
      )}
    </div>
  );
}