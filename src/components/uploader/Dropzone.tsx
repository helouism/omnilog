import { useCallback, useState, useRef } from 'react';

interface DropzoneProps {
  onFile: (file: File) => void;
}


export function Dropzone({ onFile }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size === 0) {
      setError('File is empty (0 bytes). Please select a valid log file.');
      return;
    }
    onFile(file);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4">
      <button
        type="button"
        className={`dropzone-area rounded-4 border-2 d-flex flex-column align-items-center justify-content-center gap-3 p-5 w-100 ${isDragging ? 'dropzone-active' : ''}`}
        style={{ maxWidth: 560, minHeight: 320, cursor: 'pointer', font: 'inherit' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="d-none"
          accept="*"
          aria-label="Upload log file"
          onChange={onInputChange}
        />

        <div className={`drop-icon ${isDragging ? 'drop-icon-active' : ''}`}>
          <i className="bi bi-cloud-arrow-up-fill" style={{ fontSize: '3.5rem' }} />
        </div>

        <div className="text-center">
          <h5 className="fw-semibold mb-1">
            {isDragging ? 'Release to analyse' : 'Drop your log file here'}
          </h5>
          <p className="text-secondary small mb-0">
            or <span className="text-primary text-decoration-underline">browse</span> to select
          </p>
        </div>

        <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
          {['.log', '.txt', '.csv', '.gz', 'any format'].map(ext => (
            <span key={ext} className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 px-2 py-1 small">
              {ext}
            </span>
          ))}
        </div>

        <div className="text-center mt-2">
          <p className="text-muted small mb-0">
            <i className="bi bi-shield-lock-fill text-success me-1" />
            Zero-egress: your data never leaves this device
          </p>
          <p className="text-muted small mb-0">
            Handles files up to 100+ GB via streaming
          </p>
        </div>
      </button>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mt-3 w-100" style={{ maxWidth: 560 }}>
          <i className="bi bi-exclamation-triangle-fill" />
          {error}
        </div>
      )}

      <div className="d-flex gap-4 mt-4 text-center">
        {[
          { icon: 'bi-lightning-charge-fill', label: 'Auto-detect format', color: 'text-warning' },
          { icon: 'bi-cpu-fill', label: 'Web Worker processing', color: 'text-info' },
          { icon: 'bi-cloud-slash-fill', label: 'Zero uploads', color: 'text-success' },
        ].map(({ icon, label, color }) => (
          <div key={label} className="d-flex flex-column align-items-center gap-1">
            <i className={`bi ${icon} ${color} fs-5`} />
            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
