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
  critical: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' },
  high: { bg: '#fff7ed', border: '#f97316', text: '#9a3412', icon: '#f97316' },
  medium: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
  low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', icon: '#22c55e' },
};

const CATEGORY_ICONS = {
  formula: '🔢',
  data: '📊',
  structure: '🏗️',
};

function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  const colors = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-orange-100 text-orange-800',
    F: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-lg font-bold ${colors[grade]}`}>
      Grade {grade}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${colors[severity]}`}>
      {severity}
    </span>
  );
}

function CategoryBadge({ category }: { category: Finding['category'] }) {
  const labels = { formula: 'Formula', data: 'Data Quality', structure: 'Structure' };
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
      {labels[category]}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const colors = SEVERITY_COLORS[finding.severity];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="finding-card"
      style={{
        borderLeft: `4px solid ${colors.border}`,
        backgroundColor: colors.bg,
      }}
    >
      <div className="finding-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="finding-title-row">
          <span style={{ color: colors.icon }} role="img" aria-label={finding.category}>
            {CATEGORY_ICONS[finding.category]}
          </span>
          <h4 className="finding-title" style={{ color: colors.text }}>{finding.title}</h4>
          <SeverityBadge severity={finding.severity} />
          <CategoryBadge category={finding.category} />
        </div>
        <div className="finding-meta">
          <span>📄 {finding.sheet}</span>
          {finding.location?.row !== undefined && (
            <span>📍 Row {finding.location.row + 1}, Col {String.fromCharCode(65 + (finding.location.col || 0))}</span>
          )}
          {finding.affectedCells && (
            <span>🔢 {finding.affectedCells} cell(s) affected</span>
          )}
        </div>
      </div>
      
      <div className="finding-content">
        <p className="finding-description">{finding.description}</p>
        {finding.suggestion && (
          <p className="finding-suggestion">
            <strong>Suggestion: </strong>{finding.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

export default function HealthReport({ report, onNewAnalysis }: HealthReportProps) {
  const [filterSeverity, setFilterSeverity] = useState<Finding['severity'][]>(['critical', 'high', 'medium', 'low']);
  const [filterCategory, setFilterCategory] = useState<Finding['category'][]>(['formula', 'data', 'structure']);
  const [searchQuery, setSearchQuery] = useState('');

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
      alert('Failed to generate PDF');
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
            '--score-color': report.score.score >= 80 ? '#22c55e' : report.score.score >= 60 ? '#f59e0b' : '#ef4444' 
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
              {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
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