import { Dropzone } from '../uploader/Dropzone';
import { Footer } from '../layout/Footer';

const FEATURES: [string, string, string][] = [
  ['Privacy', 'Zero egress', 'Log files are read locally via the browser File API and never sent anywhere. The Content Security Policy blocks all outbound connections involving your data.'],
  ['Scale', '100 GB+ files', 'Read in 50 MB streaming chunks via a background Web Worker, keeping the UI at 60 FPS regardless of file size. Raw log strings are discarded after each chunk.'],
  ['Detection', 'Auto-detect format', 'Confidence scoring on the first 1 MB identifies NGINX, Apache, UFW, and RFC 3164/5424 syslog, with a generic heuristic parser as fallback.'],
  ['Analysis', 'Search and filter', 'Virtual scrolling handles millions of rows. Filter by severity, date range, or full regex. Sort any column. Export the filtered view to CSV.'],
];

const FORMATS: [string, string, string][] = [
  ['NGINX', 'Combined Log Format signature', 'IP, method, path, status, bytes, referer, user agent'],
  ['Apache', 'Common Log + ErrorLog prefix', 'IP, method, path, status, bytes, error level, message'],
  ['UFW', '[UFW BLOCK/ALLOW] prefix', 'SRC, DST, protocol, destination port, TCP flags'],
  ['Syslog', 'RFC 3164/5424 PRI header', 'Facility, severity, hostname, process, message'],
  ['Generic', 'Heuristic fallback', 'Timestamp, severity level, IP addresses, free-text message'],
];

const STEPS: [string, string][] = [
  ['Drop your file', 'Drag a log file onto the drop zone, or click to browse. Any format, any size. Files never leave your computer.'],
  ['Format detection', 'OmniLog reads the first 1 MB and scores it against each parser. The highest-confidence format wins.'],
  ['Stream and explore', 'The file is processed in 50 MB chunks on a background thread. Charts and the table fill in progressively as you search.'],
];

const TRUST = ['Zero egress', 'Auto-detects format', '100 GB+ files', 'No account'];

function Hero({ onFile }: { onFile: (file: File) => void }) {
  return (
    <section className="text-center">
      <h1 className="mb-3 mx-auto" style={{ maxWidth: '16ch' }}>
        Analyze your server logs privately, in your browser
      </h1>
      <p
        className="mx-auto mb-5"
        style={{
          maxWidth: '58ch',
          fontSize: 'var(--ol-fs-md)',
          lineHeight: 'var(--ol-lh-prose)',
          color: 'var(--ol-text-dim)',
        }}
      >
        Drop any log file and get instant charts, full-text search, and CSV export.
        No uploads, no servers, no accounts.
      </p>

      <div className="mx-auto" style={{ maxWidth: 620 }}>
        <Dropzone onFile={onFile} />
      </div>

      <div
        className="d-flex flex-wrap justify-content-center gap-3 mt-3"
        style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}
      >
        {TRUST.map((t, i) => (
          <span key={t}>
            {i > 0 && <span className="me-3" aria-hidden="true">·</span>}
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="ol-grid ol-grid--quad mt-5">
      {FEATURES.map(([label, title, body]) => (
        <div className="ol-grid-cell" key={title}>
          <div className="ol-label">{label}</div>
          <h3 className="mb-2" style={{ fontSize: 'var(--ol-fs-md)', fontWeight: 600 }}>{title}</h3>
          <p className="mb-0" style={{ fontSize: 'var(--ol-fs-sm)', lineHeight: 1.6, color: 'var(--ol-text-dim)' }}>
            {body}
          </p>
        </div>
      ))}
    </section>
  );
}

function SupportedFormats() {
  return (
    <section className="mt-5">
      <h2 className="mb-3" style={{ fontSize: 'var(--ol-fs-xl)' }}>Supported log formats</h2>
      <div className="ol-panel" style={{ overflowX: 'auto' }}>
        <table className="w-100 mb-0" style={{ fontSize: 'var(--ol-fs-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Format', 'Detection', 'Extracts'].map(h => (
                <th
                  key={h}
                  className="ol-label text-start"
                  style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', borderBottom: '1px solid var(--ol-border)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORMATS.map(([fmt, detect, extracts], i) => (
              <tr key={fmt} style={i > 0 ? { borderTop: '1px solid var(--ol-border-subtle)' } : undefined}>
                <td className="font-mono" style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text)' }}>{fmt}</td>
                <td style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{detect}</td>
                <td style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{extracts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mt-5">
      <h2 className="mb-4" style={{ fontSize: 'var(--ol-fs-xl)' }}>How it works</h2>
      <div className="row g-4">
        {STEPS.map(([title, body], i) => (
          <div className="col-12 col-md-4" key={title}>
            <div style={{ borderTop: '1px solid var(--ol-border)', paddingTop: 'var(--ol-sp-3)' }}>
              <div className="ol-label mb-2">Step {i + 1}</div>
              <h3 className="mb-2" style={{ fontSize: 'var(--ol-fs-md)', fontWeight: 600 }}>{title}</h3>
              <p className="mb-0" style={{ fontSize: 'var(--ol-fs-sm)', lineHeight: 1.6, color: 'var(--ol-text-dim)' }}>
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface LandingViewProps {
  onFile: (file: File) => void;
}

/** Idle-state marketing view: shown until the user drops a log file. */
export function LandingView({ onFile }: LandingViewProps) {
  return (
    <div className="flex-grow-1 overflow-auto">
      <div style={{ maxWidth: 'var(--ol-page-max)', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
        <Hero onFile={onFile} />
        <FeatureGrid />
        <SupportedFormats />
        <HowItWorks />
        <Footer />
      </div>
    </div>
  );
}
