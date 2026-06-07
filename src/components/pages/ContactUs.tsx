import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export function ContactUs() {
  useEffect(() => {
    document.title = 'Contact — OmniLog';
  }, []);

  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>
        <Link
          to="/"
          className="text-decoration-none small mb-4 d-inline-flex align-items-center gap-1"
          style={{ color: '#8b949e' }}
        >
          <i className="bi bi-arrow-left" />
          Back to OmniLog
        </Link>

        <div className="mt-4 mb-5">
          <h1 className="fw-bold mb-2" style={{ fontSize: '1.75rem' }}>Contact</h1>
          <p className="text-secondary" style={{ lineHeight: 1.7 }}>
            Questions, bug reports, or feature suggestions — here's where to reach us.
          </p>
        </div>

        <div className="row g-4 mb-5">
          <div className="col-12 col-sm-6">
            <div className="card h-100 border-secondary p-4" style={{ background: '#161b22' }}>
              <i className="bi bi-envelope-fill text-primary mb-3" style={{ fontSize: '1.5rem' }} />
              <h5 className="fw-semibold mb-2">Email</h5>
              <p className="text-muted small mb-3">
                For general questions, feature requests, or anything else.
              </p>
              <a href="mailto:hendrikmahdi@gmail.com" className="text-info text-decoration-none small">
                hendrikmahdi@gmail.com
              </a>
            </div>
          </div>
          <div className="col-12 col-sm-6">
            <div className="card h-100 border-secondary p-4" style={{ background: '#161b22' }}>
              <i className="bi bi-telegram text-info mb-3" style={{ fontSize: '1.5rem' }} />
              <h5 className="fw-semibold mb-2">Telegram</h5>
              <p className="text-muted small mb-3">
                Follow our channel for new blog posts and updates.
              </p>
              <a
                href="https://t.me/omnilogofficial"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info text-decoration-none small"
              >
                t.me/omnilogofficial
              </a>
            </div>
          </div>
        </div>

        <div className="p-4 rounded border border-secondary" style={{ background: '#161b22' }}>
          <h5 className="fw-semibold mb-3">Privacy concern?</h5>
          <p className="text-muted mb-0" style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>
            OmniLog is fully client-side. Your log files never leave your browser —
            there is no backend server, no database, and no upload endpoint.
            If you want to verify this, read our{' '}
            <Link to="/privacy" className="text-info">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
