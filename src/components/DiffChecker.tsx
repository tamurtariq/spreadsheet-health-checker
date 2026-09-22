import { useState, useCallback } from 'react';
import { parseFile } from '../lib/parser';
import { diffFiles, formatDiffForDisplay } from '../lib/diff';
import type { DiffResult, CellDiff, ParsedFile } from '../lib/parser';
import '../styles/components.css';

interface DiffCheckerProps {
  limits: {
    diffChecker: boolean;
    maxFileSizeMB: number;
  };
  onUpgrade?: () => void;
}

export default function DiffChecker({ limits, onUpgrade }: DiffCheckerProps) {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [parsed1, setParsed1] = useState<ParsedFile | null>(null);
  const [parsed2, setParsed2] = useState<ParsedFile | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'added' | 'removed' | 'changed' | 'formula'>('all');

  const handleFile1Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setError(null);
    if (selectedFile.size > limits.maxFileSizeMB * 1024 * 1024) {
      setError(`File 1 exceeds ${limits.maxFileSizeMB} MB limit`);
      return;
    }
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload CSV or Excel files only');
      return;
    }
    setFile1(selectedFile);
  }, [limits.maxFileSizeMB]);

  const handleFile2Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setError(null);
    if (selectedFile.size > limits.maxFileSizeMB * 1024 * 1024) {
      setError(`File 2 exceeds ${limits.maxFileSizeMB} MB limit`);
      return;
    }
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload CSV or Excel files only');
      return;
    }
    setFile2(selectedFile);
  }, [limits.maxFileSizeMB]);

  const handleCompare = useCallback(async () => {
    if (!file1 || !file2) return;
    
    setIsComparing(true);
    setError(null);
    setResult(null);
    
    try {
      setProgress({ stage: 'Parsing first file...', percent: 20 });
      const p1 = await parseFile(file1);
      setParsed1(p1);
      
      setProgress({ stage: 'Parsing second file...', percent: 50 });
      const p2 = await parseFile(file2);
      setParsed2(p2);
      
      setProgress({ stage: 'Comparing files...', percent: 80 });
      const diffResult = diffFiles(p1, p2);
      setResult(diffResult);
      
      setProgress({ stage: 'Complete', percent: 100 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
      setTimeout(() => setProgress(null), 1000);
    }
  }, [file1, file2]);

  const filteredDiffs = result?.diffs.filter(d => {
    if (activeTab === 'all') return true;
    if (activeTab === 'formula') return d.type === 'formula-changed';
    return d.type === activeTab;
  }) || [];

  const typeCounts = result ? {
    added: result.summary.added,
    removed: result.summary.removed,
    changed: result.summary.changed,
    formulaChanged: result.summary.formulaChanged,
  } : { added: 0, removed: 0, changed: 0, formulaChanged: 0 };

  const handleExportCSV = () => {
    if (!result) return;
    const headers = ['Type', 'Sheet', 'Cell', 'Old Value', 'New Value', 'Old Formula', 'New Formula'];
    const rows = filteredDiffs.map(d => {
      const colLetter = String.fromCharCode(65 + d.col);
      const cellRef = `${colLetter}${d.row + 1}`;
      return [
        d.type,
        d.sheet,
        cellRef,
        d.oldFormatted || String(d.oldValue || ''),
        d.newFormatted || String(d.newValue || ''),
        d.oldFormula || '',
        d.newFormula || '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `diff-${file1?.name}-vs-${file2?.name}.csv`;
    link.click();
  };

  if (!limits.diffChecker) {
    return (
      <div className="diff-checker">
        <div className="feature-locked">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h3>Diff Checker - Pro Feature</h3>
          <p>Compare two spreadsheet versions side-by-side</p>
          <button className="upgrade-btn" onClick={onUpgrade}>
            Upgrade to Pro to Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-checker">
      <div className="diff-header">
        <h2>Spreadsheet Diff Checker</h2>
        <p>Compare two versions of a spreadsheet to see what changed</p>
      </div>

      <div className="file-inputs">
        <div className="file-input-group">
          <label htmlFor="file1">Original Version</label>
          <div className={`file-drop ${file1 ? 'has-file' : ''}`} onClick={() => document.getElementById('file1')?.click()}>
            <input id="file1" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile1Change} style={{ display: 'none' }} />
            {file1 ? (
              <div className="file-selected">
                <span className="file-name">{file1.name}</span>
                <span className="file-size">{(file1.size / 1024 / 1024).toFixed(2)} MB</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile1(null); setParsed1(null); }} className="remove-file">✕</button>
              </div>
            ) : (
              <div className="drop-prompt">Click or drag to upload original file</div>
            )}
          </div>
        </div>

        <div className="swap-icon" title="Swap files">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>

        <div className="file-input-group">
          <label htmlFor="file2">New Version</label>
          <div className={`file-drop ${file2 ? 'has-file' : ''}`} onClick={() => document.getElementById('file2')?.click()}>
            <input id="file2" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile2Change} style={{ display: 'none' }} />
            {file2 ? (
              <div className="file-selected">
                <span className="file-name">{file2.name}</span>
                <span className="file-size">{(file2.size / 1024 / 1024).toFixed(2)} MB</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile2(null); setParsed2(null); }} className="remove-file">✕</button>
              </div>
            ) : (
              <div className="drop-prompt">Click or drag to upload new file</div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {progress && (
        <div className="progress-bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          <span className="progress-text">{progress.stage}</span>
        </div>
      )}

      {!error && !isComparing && file1 && file2 && !result && (
        <button className="compare-btn" onClick={handleCompare} disabled={isComparing}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Compare Files
        </button>
      )}

      {result && (
        <div className="diff-results">
          <div className="diff-summary">
            <div className="summary-stat added">
              <span className="stat-value">{typeCounts.added}</span>
              <span className="stat-label">Added</span>
            </div>
            <div className="summary-stat removed">
              <span className="stat-value">{typeCounts.removed}</span>
              <span className="stat-label">Removed</span>
            </div>
            <div className="summary-stat changed">
              <span className="stat-value">{typeCounts.changed}</span>
              <span className="stat-label">Changed</span>
            </div>
            <div className="summary-stat formula">
              <span className="stat-value">{typeCounts.formulaChanged}</span>
              <span className="stat-label">Formula Changed</span>
            </div>
          </div>

          <div className="diff-tabs">
            <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>
              All ({result.diffs.length})
            </button>
            <button className={activeTab === 'added' ? 'active' : ''} onClick={() => setActiveTab('added')}>
              Added ({typeCounts.added})
            </button>
            <button className={activeTab === 'removed' ? 'active' : ''} onClick={() => setActiveTab('removed')}>
              Removed ({typeCounts.removed})
            </button>
            <button className={activeTab === 'changed' ? 'active' : ''} onClick={() => setActiveTab('changed')}>
              Changed ({typeCounts.changed})
            </button>
            <button className={activeTab === 'formula' ? 'active' : ''} onClick={() => setActiveTab('formula')}>
              Formula ({typeCounts.formulaChanged})
            </button>
          </div>

          <div className="diff-list">
            {filteredDiffs.length === 0 ? (
              <div className="no-diffs">No differences found for this filter</div>
            ) : (
              filteredDiffs.map((diff, index) => (
                <div key={index} className={`diff-item ${diff.type}`}>
                  <div className="diff-cell">
                    <span className="diff-type-badge {diff.type}">{diff.type}</span>
                    <span className="diff-location">{diff.sheet} • {formatDiffForDisplay(diff).split(':')[0]}</span>
                  </div>
                  <div className="diff-values">
                    {diff.type === 'removed' && <span className="old-value">- {diff.oldFormatted || diff.oldValue}</span>}
                    {diff.type === 'added' && <span className="new-value">+ {diff.newFormatted || diff.newValue}</span>}
                    {diff.type === 'changed' && (
                      <>
                        <span className="old-value">- {diff.oldFormatted || diff.oldValue}</span>
                        <span className="arrow">→</span>
                        <span className="new-value">+ {diff.newFormatted || diff.newValue}</span>
                      </>
                    )}
                    {diff.type === 'formula-changed' && (
                      <>
                        <span className="old-value">- {diff.oldFormula}</span>
                        <span className="arrow">→</span>
                        <span className="new-value">+ {diff.newFormula}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="diff-actions">
            <button className="export-btn" onClick={handleExportCSV}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Filtered (CSV)
            </button>
            <button className="new-comparison-btn" onClick={() => { setFile1(null); setFile2(null); setParsed1(null); setParsed2(null); setResult(null); }}>
              New Comparison
            </button>
          </div>
        </div>
      )}
    </div>
  );
}