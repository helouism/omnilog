import { useNavigate } from 'react-router-dom';

export function AboutUs() {
  const navigate = useNavigate();
  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>

        <button className="btn btn-sm btn-outline-secondary mb-4" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2" />Back
        </button>

        <div className="d-flex align-items-center gap-3 mb-4">
          <img src="/favicon.svg" alt="" width={40} height={38} style={{ display: 'block' }} />
          <div>
            <h1 className="fw-bold mb-0" style={{ fontSize: '1.75rem' }}>OmniLog</h1>
            <span className="text-muted small">Analytics Engine</span>
          </div>
        </div>

        <p className="lead text-secondary mb-5">
          A high-performance, privacy-first log analytics platform that runs 100% in your browser.
          Your log files are never uploaded — all processing happens locally on your machine.
        </p>

        <div className="row g-4 mb-5">
          {[
            { icon: 'bi-shield-lock-fill', color: 'text-success', title: 'Zero Egress', body: 'Your log files never leave your device. No uploads, no servers, no third-party services. The app ships with a strict Content Security Policy that blocks all outbound connections.' },
            { icon: 'bi-cpu-fill', color: 'text-primary', title: 'Web Worker Pipeline', body: 'Heavy parsing runs in a background Web Worker, keeping the UI at 60 FPS even for 100 GB+ files. Data is streamed in 50 MB chunks and aggregated progressively.' },
            { icon: 'bi-file-earmark-text-fill', color: 'text-warning', title: 'Multi-Format Support', body: 'Built-in parsers for NGINX, Apache, UFW, Syslog, and a generic heuristic fallback. Format is auto-detected by confidence scoring on the first 1 MB of the file.' },
            { icon: 'bi-database-fill', color: 'text-info', title: 'Session Persistence', body: 'Parsed results are saved to IndexedDB so your last session is instantly restored when you reopen the app — no need to re-upload the file.' },
          ].map(f => (
            <div className="col-12 col-sm-6" key={f.title}>
              <div className="card h-100 border-secondary" style={{ background: '#161b22' }}>
                <div className="card-body p-4">
                  <i className={`bi ${f.icon} ${f.color} mb-3`} style={{ fontSize: '1.5rem' }} />
                  <h6 className="fw-semibold mb-2">{f.title}</h6>
                  <p className="text-muted small mb-0">{f.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h5 className="fw-semibold mb-3 text-secondary">Supported Log Formats</h5>
        <div className="table-responsive mb-5">
          <table className="table table-dark table-sm table-bordered border-secondary" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-muted">
                <th>Format</th>
                <th>Confidence Threshold</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['NGINX', '0.92', 'Combined Log Format'],
                ['Apache', '0.90', 'Common Log + ErrorLog prefix'],
                ['UFW', '0.95', '[UFW BLOCK/ALLOW] prefix'],
                ['Syslog', '0.88', 'RFC 3164/5424 PRI header'],
                ['Generic', 'Fallback', 'Heuristic timestamp + severity + IP'],
              ].map(([fmt, thr, sig]) => (
                <tr key={fmt}>
                  <td className="text-light fw-semibold">{fmt}</td>
                  <td className="text-info">{thr}</td>
                  <td className="text-muted">{sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
