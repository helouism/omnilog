import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '../icons';
import { Footer } from '../layout/Footer';

/** Four capabilities, as hairline grid cells. The old version gave each card its
 *  own hue (success / primary / warning / info); colour in this design system has
 *  to mean something, and "this is the third card" is not a meaning. */
const FEATURES: [string, string, string][] = [
  ['Privacy', 'Zero egress', 'Your log files never leave your device. No uploads, no servers, no third-party services. The app ships with a strict Content Security Policy that blocks all outbound connections.'],
  ['Throughput', 'Web Worker pipeline', 'Heavy parsing runs in a background Web Worker, keeping the UI at 60 FPS even for 100 GB+ files. Data is streamed in 50 MB chunks and aggregated progressively.'],
  ['Coverage', 'Multi-format support', 'Built-in parsers for NGINX, Apache, UFW, Syslog, and a generic heuristic fallback. Format is auto-detected by confidence scoring on the first 1 MB of the file.'],
  ['Continuity', 'Session persistence', 'Parsed results are saved to IndexedDB so your last session is instantly restored when you reopen the app — no need to re-upload the file.'],
];

const FORMATS: [string, string, string][] = [
  ['NGINX', '0.92', 'Combined Log Format'],
  ['Apache', '0.90', 'Common Log + ErrorLog prefix'],
  ['UFW', '0.95', '[UFW BLOCK/ALLOW] prefix'],
  ['Syslog', '0.88', 'RFC 3164/5424 PRI header'],
  ['Generic', 'Fallback', 'Heuristic timestamp + severity + IP'],
];

export function AboutUs() {
  useEffect(() => {
    document.title = 'About OmniLog — Privacy-First Browser Log Analytics';
  }, []);
  const navigate = useNavigate();

  return (
    <div className="flex-grow-1 overflow-auto">
      <div style={{ maxWidth: 'var(--ol-page-max)', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
        {/* Footer sits OUTSIDE <main> on purpose: a <footer> descended from
            <main> stops being exposed as the contentinfo landmark. */}
        <main>
          <button type="button" className="ol-btn mb-5" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />Back
          </button>

          <div className="d-flex align-items-center gap-3 mb-4">
            <img src="/favicon.svg" alt="" width={40} height={38} style={{ display: 'block' }} />
            <div>
              <h1 className="mb-0" style={{ fontSize: 'var(--ol-fs-2xl)' }}>OmniLog</h1>
              <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>Analytics Engine</span>
            </div>
          </div>

          <p
            className="ol-measure mb-5"
            style={{
              fontSize: 'var(--ol-fs-md)',
              lineHeight: 'var(--ol-lh-prose)',
              color: 'var(--ol-text-dim)',
            }}
          >
            A high-performance, privacy-first log analytics platform that runs 100% in your browser.
            Your log files are never uploaded; all processing happens locally on your machine.
          </p>

          <div
            className="ol-measure mb-5"
            style={{
              fontSize: 'var(--ol-fs-sm)',
              color: 'var(--ol-text-dim)',
            }}
          >
            <p className="mb-1">
              OmniLog is completely open source! We believe in transparency and community-driven development.
            </p>
            <p className="mb-0">
              View the source code, report issues, or contribute on GitHub at: <a href="https://github.com/helouism/omnilog" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ol-text)' }}>https://github.com/helouism/omnilog</a>.
            </p>
          </div>

          <section className="ol-grid ol-grid--quad">
            {FEATURES.map(([label, title, body]) => (
              <div className="ol-grid-cell" key={title}>
                <div className="ol-label">{label}</div>
                <h2 className="mb-2" style={{ fontSize: 'var(--ol-fs-md)', fontWeight: 600 }}>{title}</h2>
                <p className="mb-0" style={{ fontSize: 'var(--ol-fs-sm)', lineHeight: 1.6, color: 'var(--ol-text-dim)' }}>
                  {body}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-5">
            <h2 className="mb-3" style={{ fontSize: 'var(--ol-fs-xl)' }}>Supported log formats</h2>
            <div className="ol-panel" style={{ overflowX: 'auto' }}>
              <table className="w-100 mb-0" style={{ fontSize: 'var(--ol-fs-sm)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Format', 'Confidence threshold', 'Signature'].map(h => (
                      <th
                        key={h}
                        scope="col"
                        className="ol-label text-start"
                        style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', borderBottom: '1px solid var(--ol-border)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FORMATS.map(([fmt, thr, sig], i) => (
                    <tr key={fmt} style={i > 0 ? { borderTop: '1px solid var(--ol-border-subtle)' } : undefined}>
                      <td className="font-mono" style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text)' }}>{fmt}</td>
                      <td className="font-mono" style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{thr}</td>
                      <td style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{sig}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>
        <Footer />
      </div>
    </div>
  );
}
