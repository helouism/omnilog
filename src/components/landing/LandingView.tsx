import { Dropzone } from '../uploader/Dropzone';

const FEATURES = [
  {
    icon: 'bi-shield-lock-fill',
    color: 'text-success',
    title: 'Zero Egress',
    body: 'Log files are read locally via the browser File API and never sent anywhere. The Content Security Policy enforced by the server blocks all outbound connections involving your data.',
  },
  {
    icon: 'bi-cpu-fill',
    color: 'text-primary',
    title: '100 GB+ Files',
    body: 'Files are read in 50 MB streaming chunks via a background Web Worker, keeping the UI at 60 FPS regardless of file size. Only aggregated data crosses to the main thread — raw log strings are discarded after each chunk.',
  },
  {
    icon: 'bi-braces-asterisk',
    color: 'text-warning',
    title: 'Auto-Detect Format',
    body: 'Confidence scoring on the first 1 MB of your file automatically identifies NGINX combined log, Apache access/error log, UFW firewall log, and RFC 3164/5424 syslog. Falls back to a generic heuristic parser for anything else.',
  },
  {
    icon: 'bi-table',
    color: 'text-info',
    title: 'Search and Filter',
    body: 'Virtual scrolling table handles millions of rows without slowdown. Filter by severity, date range, IP CIDR, or full regex. Sort any column. Export the current filtered view to CSV.',
  },
];

const FORMATS: [string, string, string][] = [
  ['NGINX', 'Combined Log Format signature', 'IP, method, path, status, bytes, referer, user agent'],
  ['Apache', 'Common Log + ErrorLog prefix', 'IP, method, path, status, bytes, error level, message'],
  ['UFW', '[UFW BLOCK/ALLOW] prefix', 'SRC, DST, protocol, destination port, TCP flags'],
  ['Syslog', 'RFC 3164/5424 PRI header', 'Facility, severity, hostname, process, message'],
  ['Generic', 'Heuristic fallback', 'Timestamp, severity level, IP addresses, free-text message'],
];

const STEPS = [
  {
    step: '1',
    title: 'Drop Your File',
    body: 'Drag a log file onto the drop zone, or click to browse. Any format accepted, any size. Files never leave your computer.',
  },
  {
    step: '2',
    title: 'Format Detection',
    body: 'OmniLog reads the first 1 MB and scores it against each parser. The highest-confidence format wins. The detected format and confidence score appear in the top bar.',
  },
  {
    step: '3',
    title: 'Stream and Explore',
    body: 'The file is processed in 50 MB chunks in a background thread. Charts and the log table update progressively as each chunk completes. Search and filter as you go.',
  },
];

function Hero() {
  return (
    <div className="text-center mb-5">
      <h1 className="fw-bold mb-3" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', lineHeight: 1.25 }}>
        Analyze Your Server Logs<br />Privately, In Your Browser
      </h1>
      <p className="text-secondary mx-auto mt-3" style={{ maxWidth: 560, lineHeight: 1.75, fontSize: '1rem' }}>
        Drop any log file and get instant charts, full-text search, and CSV export.
        No uploads, no servers, no accounts. Everything processes locally in your browser tab.
      </p>
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="row g-3 mb-5">
      {FEATURES.map(f => (
        <div className="col-12 col-sm-6 col-lg-3" key={f.title}>
          <div className="h-100 p-3 rounded border border-secondary" style={{ background: '#161b22' }}>
            <i className={`bi ${f.icon} ${f.color} d-block mb-2`} style={{ fontSize: '1.3rem' }} />
            <h6 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>{f.title}</h6>
            <p className="text-muted mb-0" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupportedFormats() {
  return (
    <div className="mb-5">
      <h2 className="fw-semibold mb-3" style={{ fontSize: '1.1rem' }}>Supported Log Formats</h2>
      <div className="table-responsive">
        <table className="table table-dark table-sm border-secondary mb-0" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr className="text-muted">
              <th>Format</th>
              <th>Detection</th>
              <th>Extracts</th>
            </tr>
          </thead>
          <tbody>
            {FORMATS.map(([fmt, detect, extracts]) => (
              <tr key={fmt}>
                <td className="text-light fw-semibold">{fmt}</td>
                <td className="text-muted">{detect}</td>
                <td className="text-muted">{extracts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <div>
      <h2 className="fw-semibold mb-4" style={{ fontSize: '1.1rem' }}>How It Works</h2>
      <div className="row g-3">
        {STEPS.map(s => (
          <div className="col-12 col-md-4" key={s.step}>
            <div className="p-3 rounded border border-secondary h-100" style={{ background: '#161b22' }}>
              <div className="fw-bold text-primary mb-2" style={{ fontSize: '1.1rem' }}>{s.step}</div>
              <h6 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>{s.title}</h6>
              <p className="text-muted mb-0" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LandingViewProps {
  onFile: (file: File) => void;
}

/** Idle-state marketing view: shown until the user drops a log file. */
export function LandingView({ onFile }: LandingViewProps) {
  return (
    <div className="flex-grow-1 overflow-auto">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <Hero />

        <div style={{ height: 440, maxWidth: 620, margin: '0 auto 3.5rem' }}>
          <Dropzone onFile={onFile} />
        </div>

        <FeatureGrid />
        <SupportedFormats />
        <HowItWorks />
      </div>
    </div>
  );
}
