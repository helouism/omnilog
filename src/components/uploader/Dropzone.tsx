import { useCallback, useState, useRef } from 'react';
import { CloudArrowUp, ExclamationTriangle } from '../icons';

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
    <div className="w-100">
      <input
        ref={inputRef}
        type="file"
        className="d-none"
        accept="*/*"
        aria-label="Upload log file"
        onChange={onInputChange}
      />

      <button
        type="button"
        className={`ol-dropzone ${isDragging ? 'is-active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <span className="ol-dropzone-icon">
          <CloudArrowUp size={32} />
        </span>

        <span style={{ fontSize: 'var(--ol-fs-lg)', fontWeight: 600, letterSpacing: '-0.014em' }}>
          {isDragging ? 'Release to analyse' : 'Drop your log file here'}
        </span>

        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}>
          or click to browse — any format, any size
        </span>
      </button>

      {error && (
        // The border comes from --error, not an inline borderColor: it belongs
        // with the panel, not with one usage of it. Colour and size stay inline
        // because the modifier deliberately carries border-color only.
        <div
          className="ol-panel ol-panel--error ol-panel-pad d-flex align-items-center gap-2 mt-3"
          role="alert"
          style={{ color: 'var(--ol-sev-error)', fontSize: 'var(--ol-fs-sm)' }}
        >
          <ExclamationTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
