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
    <div
      className="px-4 py-2"
      style={{ background: 'var(--ol-bg)', borderBottom: '1px solid var(--ol-border)' }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}>
          {isSniffing ? 'Detecting format…' : `Parsing ${state.fileName}`}
        </span>
        <div className="d-flex gap-3" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
          {!isSniffing && (
            <>
              <span>{formatBytes(state.processedBytes)} / {formatBytes(state.totalBytes)}</span>
              <span>{state.linesProcessed.toLocaleString()} lines</span>
              {state.eta > 0 && <span>{formatEta(state.eta)}</span>}
            </>
          )}
        </div>
      </div>
      {/* The meaningful boundary here is filled-vs-unfilled, which is
          --ol-accent on --ol-border-subtle at 6.24:1 — well past SC 1.4.11's
          3:1. The track's own edge against the page is only 1.24:1, and that is
          deliberate: the numbers above carry the value, so the track is a hint
          at where the bar will reach, not a graphic the reading depends on. */}
      <div style={{ height: 3, background: 'var(--ol-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: '100%',
            background: 'var(--ol-accent)',
            transformOrigin: 'left',
            transform: `scaleX(${isSniffing ? 1 : state.progress / 100})`,
            transition: 'transform 0.3s ease',
            opacity: isSniffing ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}
