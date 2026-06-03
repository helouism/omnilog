import type { AnalyticsState } from '../../hooks/useLogAnalytics';

interface ProgressBarProps {
  state: AnalyticsState;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `~${seconds}s remaining`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `~${m}m ${s}s remaining`;
}

export function ProgressBar({ state }: ProgressBarProps) {
  if (state.status !== 'parsing' && state.status !== 'sniffing') return null;

  const isSniffing = state.status === 'sniffing';

  return (
    <div className="progress-container px-3 py-2 border-bottom border-secondary">
      <div className="d-flex justify-content-between align-items-center mb-1 small">
        <span className="text-secondary">
          {isSniffing ? (
            <><i className="bi bi-search me-1" />Detecting format…</>
          ) : (
            <><i className="bi bi-cpu me-1" />Parsing {state.fileName}</>
          )}
        </span>
        <div className="d-flex gap-3 text-muted small">
          {!isSniffing && (
            <>
              <span>{formatBytes(state.processedBytes)} / {formatBytes(state.totalBytes)}</span>
              <span>{state.linesProcessed.toLocaleString()} lines</span>
              {state.eta > 0 && <span>{formatEta(state.eta)}</span>}
            </>
          )}
        </div>
      </div>
      <div className="progress" style={{ height: 6 }}>
        <div
          className={`progress-bar ${isSniffing ? 'progress-bar-striped progress-bar-animated' : ''} bg-primary`}
          style={{
            width: '100%',
            transformOrigin: 'left',
            transform: `scaleX(${isSniffing ? 1 : state.progress / 100})`,
            transition: 'transform 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
