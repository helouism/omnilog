import { Link } from 'react-router-dom';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';

interface NavbarProps {
  state: AnalyticsState;
  onReset: () => void;
}

const FORMAT_BADGE_COLOR: Record<string, string> = {
  nginx: 'success',
  apache: 'warning',
  ufw: 'danger',
  syslog: 'info',
  generic: 'secondary',
  unknown: 'dark',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const NAV_LINKS = [
  { label: 'Blog', to: '/blog' },
  { label: 'About', to: '/about' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
];

export function Navbar({ state, onReset }: NavbarProps) {
  const isActive = state.status !== 'idle';

  return (
    <nav className="navbar navbar-dark bg-dark border-bottom border-secondary px-3 py-2">
      <div className="d-flex align-items-center gap-3">
        <Link
          to="/"
          className="navbar-brand mb-0 fw-bold text-white d-flex align-items-center gap-2 text-decoration-none"
        >
          <img src="/favicon.svg" alt="" width={22} height={21} style={{ display: 'block' }} />
          OmniLog
        </Link>
        {isActive && state.fileName && (
          <span className="text-secondary small d-none d-md-inline">
            {state.fileName}
            <span className="ms-2 text-muted">({formatBytes(state.fileSize)})</span>
          </span>
        )}
      </div>

      <div className="d-flex align-items-center gap-3">
        <div className="d-flex gap-3">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-muted text-decoration-none"
              style={{ fontSize: '0.8rem' }}
            >
              {label}
            </Link>
          ))}
        </div>

        {isActive && state.format !== 'unknown' && (
          <span className={`badge bg-${FORMAT_BADGE_COLOR[state.format] ?? 'secondary'}`}>
            <i className="bi bi-braces me-1" />
            {state.format.toUpperCase()}
            {state.confidence > 0 && (
              <span className="ms-1 opacity-75">
                {Math.round(state.confidence * 100)}%
              </span>
            )}
          </span>
        )}

        {state.status === 'parsing' && (
          <span className="badge bg-primary d-flex align-items-center gap-1">
            <span className="spinner-border spinner-border-sm" />
            {state.progress}%
          </span>
        )}

        {isActive && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            aria-label="Clear and reset"
            title="Clear and reset"
            onClick={onReset}
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>
    </nav>
  );
}
