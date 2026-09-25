import { useState, useMemo } from 'react';
import type { HealthReport as HealthReportType, Finding } from '../lib/checks/types';
import { sortFindings, filterFindings, exportFindingsCSV } from '../lib/engine';
import '../styles/components.css';

interface TierLimits {
  pdfExport: boolean;
}

interface HealthReportProps {
  report: HealthReportType;
  onNewAnalysis: () => void;
  limits: TierLimits;
}

const SEVERITY_COLORS = {
  critical: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)', text: 'var(--color-danger-text)', icon: 'var(--color-danger)' },
  high: { bg: 'var(--color-high-bg)', border: 'var(--color-high)', text: 'var(--color-high-text)', icon: 'var(--color-high)' },
  medium: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', text: 'var(--color-warning-text)', icon: 'var(--color-warning)' },
  low: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', text: 'var(--color-success-text)', icon: 'var(--color-success)' },
};

const CATEGORY_ICONS = {
  formula: '🔢',
  data: '📊',
  structure: '🏗️',
};

const GRADE_COLORS: Record<'A' | 'B' | 'C' | 'D' | 'F', { bg: string; text: string }> = {
  A: { bg: 'var(--color-success-bg-strong)', text: 'var(--color-success-text)' },
  B: { bg: 'var(--color-info-bg-strong)', text: 'var(--color-info-text)' },
  C: { bg: 'var(--color-warning-bg-strong)', text: 'var(--color-warning-text)' },
  D: { bg: 'var(--color-high-bg)', text: 'var(--color-high-text)' },
  F: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' },
};

function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  const { bg, text } = GRADE_COLORS[grade];
  return (
    <span style={{ padding: '0.25rem 0.75rem', borderRadius: 9999, fontSize: '1.125rem', fontWeight: 700, background: bg, color: text }}>
      Grade {grade}
    </span>
  );
}

const SEVERITY_BADGE_COLORS: Record<Finding['severity'], { bg: string; text: string }> = {
  critical: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' },
  high: { bg: 'var(--color-high-bg)', text: 'var(--color-high-text)' },
  medium: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
  low: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
};

function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const { bg, text } = SEVERITY_BADGE_COLORS[severity];
  return (
    <span style={{ padding: '0.125rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', background: bg, color: text }}>
      {severity}
    </span>
  );
}

function CategoryBadge({ category }: { category: Finding['category'] }) {
  const labels = { formula: 'Formula', data: 'Data Quality', structure: 'Structure' };
  return (
    <span style={{ padding: '0.125rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500, background: 'var(--gray-100)', color: 'var(--color-text-secondary)' }}>
      {labels[category]}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const colors = SEVERITY_COLORS[finding.severity];
  const [expanded, setExpanded] = useState(false);
  const contentId = `finding-content-${finding.id}`;

  return (
    <div
      className="finding-card"
      style={{
        borderLeft: `3px solid ${colors.border}`,
      }}
    >
      <button
        type="button"
        className="finding-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <div className="finding-title-row">
          <span style={{ color: colors.icon }} aria-hidden="true">
            {CATEGORY_ICONS[finding.category]}
          </span>
          <h4 className="finding-title" style={{ color: colors.text }}>{finding.title}</h4>
          <SeverityBadge severity={finding.severity} />
          <CategoryBadge category={finding.category} />
          <svg className="finding-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="finding-meta">
          <span><span aria-hidden="true">📄</span> {finding.sheet}</span>
          {finding.location?.row !== undefined && (
            <span><span aria-hidden="true">📍</span> Row {finding.location.row + 1}, Col {String.fromCharCode(65 + (finding.location.col || 0))}</span>
          )}
          {finding.affectedCells && (
            <span><span aria-hidden="true">🔢</span> {finding.affectedCells} cell(s) affected</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="finding-content" id={contentId}>
          <p className="finding-description">{finding.description}</p>
          {finding.suggestion && (
            <p className="finding-suggestion">
              <strong>Suggestion: </strong>{finding.suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HealthReport({ report, onNewAnalysis }: HealthReportProps) {
  const [filterSeverity, setFilterSeverity] = useState<Finding['severity'][]>(['critical', 'high', 'medium', 'low']);
  const [filterCategory, setFilterCategory] = useState<Finding['category'][]>(['formula', 'data', 'structure']);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);

  const filteredFindings = useMemo(() => {
    let findings = filterFindings(report.findings, {
      severity: filterSeverity.length < 4 ? filterSeverity : undefined,
      category: filterCategory.length < 3 ? filterCategory : undefined,
    });
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      findings = findings.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.sheet.toLowerCase().includes(query)
      );
    }
    
    return sortFindings(findings);
  }, [report.findings, filterSeverity, filterCategory, searchQuery]);

  const handleExportCSV = () => {
    const csv = exportFindingsCSV(filteredFindings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${report.fileName.replace(/\.[^.]+$/, '')}-health-report.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    setPdfError(null);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageSize = { width: 612, height: 792 };
      let page = pdfDoc.addPage(pageSize);
      const { width, height } = page.getSize();
      const margin = 50;
      let y = height - margin;
      
      const drawText = (text: string, x: number, y: number, fontSize = 10, bold = false, color: any) => {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: bold ? fontBold : font,
          color,
        });
      };
      
      const checkSpace = (needed: number) => {
        if (y - needed < margin) {
          page = pdfDoc.addPage(pageSize);
          y = height - margin;
        }
      };
      
      // Title
      drawText(`Health Report: ${report.fileName}`, margin, y, 20, true);
      y -= 30;
      
      // Score
      drawText(`Score: ${report.score.score}/100 (Grade ${report.score.grade})`, margin, y, 14, true);
      y -= 20;
      
      // Summary
      drawText('Summary', margin, y, 12, true);
      y -= 18;
      drawText(`Sheets Analyzed: ${report.summary.sheetsAnalyzed}`, margin + 10, y, 10);
      y -= 16;
      drawText(`Total Cells: ${report.summary.totalCells.toLocaleString()}`, margin + 10, y, 10);
      y -= 16;
      drawText(`Formulas Found: ${report.summary.totalFormulas}`, margin + 10, y, 10);
      y -= 16;
      drawText(`Total Findings: ${report.findings.length}`, margin + 10, y, 10);
      y -= 24;
      
      // Severity breakdown
      drawText('Findings by Severity', margin, y, 12, true);
      y -= 18;
      Object.entries(severityCounts).forEach(([severity, count]) => {
        if (count > 0) {
          checkSpace(16);
          drawText(`${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${count}`, margin + 10, y, 10);
          y -= 16;
        }
      });
      y -= 16;
      
      // Findings
      drawText('Detailed Findings', margin, y, 12, true);
      y -= 18;
      
      filteredFindings.forEach((finding, index) => {
        checkSpace(60);
        drawText(`${index + 1}. ${finding.title}`, margin, y, 10, true);
        y -= 14;
        drawText(`Category: ${finding.category} | Severity: ${finding.severity} | Sheet: ${finding.sheet}`, margin + 10, y, 9);
        y -= 13;
        if (finding.location?.row !== undefined) {
          drawText(`Location: Row ${finding.location.row + 1}, Col ${String.fromCharCode(65 + (finding.location.col || 0))}`, margin + 10, y, 9);
          y -= 13;
        }
        drawText(finding.description, margin + 10, y, 9);
        y -= 13;
        if (finding.suggestion) {
          drawText(`Suggestion: ${finding.suggestion}`, margin + 10, y, 9, false, rgb(0.3, 0.3, 0.3));
          y -= 13;
        }
        y -= 8;
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${report.fileName.replace(/\.[^.]+$/, '')}-health-report.pdf`;
      link.click();
    } catch (error) {
      console.error('PDF export failed:', error);
      setPdfError('Failed to generate PDF. Please try again.');
    }
  };

  const severityCounts = useMemo(() => ({
    critical: report.findings.filter(f => f.severity === 'critical').length,
    high: report.findings.filter(f => f.severity === 'high').length,
    medium: report.findings.filter(f => f.severity === 'medium').length,
    low: report.findings.filter(f => f.severity === 'low').length,
  }), [report.findings]);

  return (
    <div className="health-report">
      <div className="report-header">
        <div className="report-title-section">
          <h2>Health Report: {report.fileName}</h2>
          <GradeBadge grade={report.score.grade} />
        </div>
        <div className="report-score">
          <div className="score-circle" style={{
            '--score-color': report.score.score >= 80 ? 'var(--color-success)' : report.score.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'
          }}>
            <span className="score-value">{report.score.score}</span>
            <span className="score-label">/ 100</span>
          </div>
        </div>
      </div>

      <div className="report-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-value">{report.summary.sheetsAnalyzed}</span>
            <span className="summary-label">Sheets Analyzed</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{report.summary.totalCells.toLocaleString()}</span>
            <span className="summary-label">Total Cells</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{report.summary.totalFormulas}</span>
            <span className="summary-label">Formulas Found</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{report.findings.length}</span>
            <span className="summary-label">Total Findings</span>
          </div>
        </div>
        
        <div className="severity-breakdown">
          {Object.entries(severityCounts).map(([severity, count]) => (
            count > 0 && (
              <button
                key={severity}
                className="severity-filter-btn"
                onClick={() => setFilterSeverity(prev => 
                  prev.includes(severity as Finding['severity']) 
                    ? prev.filter(s => s !== severity) 
                    : [...prev, severity as Finding['severity']]
                )}
                style={{
                  borderColor: SEVERITY_COLORS[severity as Finding['severity']].border,
                  color: filterSeverity.includes(severity as Finding['severity']) ? 'white' : SEVERITY_COLORS[severity as Finding['severity']].text,
                  backgroundColor: filterSeverity.includes(severity as Finding['severity']) ? SEVERITY_COLORS[severity as Finding['severity']].border : SEVERITY_COLORS[severity as Finding['severity']].bg,
                }}
              >
                <span className="severity-dot" style={{ backgroundColor: filterSeverity.includes(severity as Finding['severity']) ? 'white' : SEVERITY_COLORS[severity as Finding['severity']].border }} />
                {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
              </button>
            )
          ))}
        </div>
      </div>

      <div className="report-filters">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search findings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="category-filters">
          {(['formula', 'data', 'structure'] as Finding['category'][]).map(cat => (
            <button
              key={cat}
              className={`category-filter-btn ${filterCategory.includes(cat) ? 'active' : ''}`}
              onClick={() => setFilterCategory(prev => 
                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
              )}
            >
              <span aria-hidden="true">{CATEGORY_ICONS[cat]}</span> {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="report-actions">
        <button className="export-btn" onClick={handleExportCSV}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Findings (CSV)
        </button>
        {limits.pdfExport && (
          <button className="export-btn pdf-btn" onClick={handleExportPDF}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Export Report (PDF)
          </button>
        )}
        <button className="new-analysis-btn" onClick={onNewAnalysis}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Analysis
        </button>
      </div>

      {pdfError && (
        <div className="error-message" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{pdfError}</span>
        </div>
      )}

      <div className="findings-list">
        {filteredFindings.length === 0 ? (
          <div className="no-findings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3>No findings match your filters</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          filteredFindings.map(finding => (
            <FindingCard key={finding.id} finding={finding} />
          ))
        )}
      </div>
    </div>
  );
}