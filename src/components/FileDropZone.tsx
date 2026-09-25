import { useState, useCallback } from 'react';
import '../styles/components.css';

export interface FileDropZoneProgress {
  stage: string;
  percent: number;
}

interface FileDropZoneProps {
  onRun: (file: File, setProgress: (progress: FileDropZoneProgress | null) => void) => Promise<void>;
  actionLabel: string;
  accept?: string;
  acceptedExtensions?: string[];
  maxFileSize?: number;
  invalidExtensionMessage?: string;
}

export default function FileDropZone({
  onRun,
  actionLabel,
  accept = '.csv,.xlsx,.xls',
  acceptedExtensions = ['csv', 'xlsx', 'xls'],
  maxFileSize = 50 * 1024 * 1024,
  invalidExtensionMessage,
}: FileDropZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<FileDropZoneProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    if (selectedFile.size > maxFileSize) {
      setError(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)} MB limit`);
      return;
    }

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!acceptedExtensions.includes(ext || '')) {
      setError(invalidExtensionMessage ?? `Please upload a ${acceptedExtensions.map(e => e.toUpperCase()).join(' or ')} file`);
      return;
    }

    setFile(selectedFile);
  }, [maxFileSize, acceptedExtensions, invalidExtensionMessage]);

  const handleRun = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      await onRun(file, setProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(null), 1000);
    }
  }, [file, onRun]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const event = { target: { files: [droppedFile] } } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  }, [handleFileChange]);

  return (
    <div className="file-upload">
      <div
        className={`drop-zone ${file ? 'has-file' : ''} ${isProcessing ? 'analyzing' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          className="sr-only"
          accept={accept}
          onChange={handleFileChange}
          disabled={isProcessing}
        />

        {file ? (
          <div className="file-selected">
            <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button type="button" className="remove-file" onClick={() => setFile(null)} aria-label="Remove file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="drop-prompt">
            <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>Drag & drop a spreadsheet file here, or click to browse</p>
            <span className="file-types">
              {acceptedExtensions.map(e => e.toUpperCase()).join(', ')} • Up to {Math.round(maxFileSize / 1024 / 1024)} MB
            </span>
            <label htmlFor="file-input" className="browse-btn">Browse Files</label>
          </div>
        )}
      </div>

      {progress && (
        <div className="progress-bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          <span className="progress-text">{progress.stage}</span>
        </div>
      )}

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

      {file && !isProcessing && (
        <button
          className="analyze-btn"
          onClick={handleRun}
          disabled={isProcessing}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
