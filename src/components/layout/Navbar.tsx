import { Link } from 'react-router-dom';
import { XLg } from '../icons';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';

interface NavbarProps {
  state: AnalyticsState;
  onReset: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const NAV_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Privacy', to: '/privacy' },
];

export function Navbar({ state, onReset }: NavbarProps) {
  const isActive = state.status !== 'idle';

  return (
    <nav
      className="d-flex align-items-center justify-content-between gap-3 px-3"
      style={{
        minHeight: 52,
        background: 'var(--ol-bg)',
        borderBottom: '1px solid var(--ol-border)',
      }}
    >
      {/* Left zone: identity + live instrument readout */}
      {/* minWidth:0 is required for the filename's text-truncate to work inside flex */}
      <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
        <Link
          to="/"
          className="d-flex align-items-center gap-2 text-decoration-none"
          style={{ color: 'var(--ol-text)', fontWeight: 600, letterSpacing: '-0.021em' }}
        >
          <img src="/favicon.svg" alt="" width={20} height={20} style={{ display: 'block' }} />
          OmniLog
        </Link>

        {isActive && state.fileName && (
          <span
            className="font-mono text-truncate d-none d-md-inline"
            style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}
          >
            {state.fileName}
            <span style={{ color: 'var(--ol-text-faint)' }}> · {formatBytes(state.fileSize)}</span>
          </span>
        )}

        {isActive && state.format !== 'unknown' && (
          <span className="ol-chip">
            {state.format.toUpperCase()}
            {state.confidence > 0 && (
              <span style={{ color: 'var(--ol-text-faint)' }}>
                {Math.round(state.confidence * 100)}%
              </span>
            )}
          </span>
        )}

        {state.status === 'parsing' && (
          <span className="ol-chip ol-chip--accent">{state.progress}%</span>
        )}
      </div>

      {/* Right zone: navigation — recedes while an analysis is active */}
      <div className="d-flex align-items-center gap-3">
        <div className="d-none d-sm-flex align-items-center gap-3">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-decoration-none"
              style={{
                fontSize: 'var(--ol-fs-xs)',
                color: isActive ? 'var(--ol-text-faint)' : 'var(--ol-text-dim)',
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {isActive && (
          <button
            type="button"
            className="ol-btn ol-btn--ghost ol-btn--icon"
            aria-label="Clear and reset"
            title="Clear and reset"
            onClick={onReset}
          >
            <XLg size={14} />
          </button>
        )}
      </div>
    </nav>
  );
}
