interface Props { onBack: () => void }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h5 className="fw-semibold mb-3" style={{ color: '#e6edf3' }}>{title}</h5>
      <div className="text-muted" style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
}

export function PrivacyPolicy({ onBack }: Props) {
  return (
    <div className="d-flex flex-column h-100 overflow-auto" style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>

        <button className="btn btn-sm btn-outline-secondary mb-4" onClick={onBack}>
          <i className="bi bi-arrow-left me-2" />Back
        </button>

        <div className="mb-4">
          <h1 className="fw-bold mb-1" style={{ fontSize: '1.75rem' }}>Privacy Policy</h1>
          <span className="text-muted small">Last updated: May 2026</span>
        </div>

        <div className="card border-success mb-5 p-4" style={{ background: '#0f2a1a' }}>
          <div className="d-flex gap-3 align-items-start">
            <i className="bi bi-shield-check-fill text-success mt-1" style={{ fontSize: '1.5rem', flexShrink: 0 }} />
            <div>
              <div className="fw-semibold text-success mb-1">Your data never leaves your device</div>
              <div className="text-muted small">
                OmniLog processes all log files locally in your browser. No data is ever transmitted to any server.
                There are no analytics, no tracking, and no external connections of any kind.
              </div>
            </div>
          </div>
        </div>

        <Section title="1. Information We Collect">
          <p>We collect <strong className="text-light">no information whatsoever</strong>.</p>
          <p>
            OmniLog is a fully client-side application. It has no backend, no database, and makes no outbound
            network requests. Your log files are read directly from your local filesystem via the browser's
            File API and are processed entirely within your browser tab using Web Workers.
          </p>
        </Section>

        <Section title="2. Log File Processing">
          <p>When you drop a log file into OmniLog:</p>
          <ul>
            <li>The file is read locally by your browser — it is never uploaded to any server.</li>
            <li>Raw log lines are parsed in a background Web Worker and immediately discarded from memory after each chunk is processed.</li>
            <li>Only aggregated data (counts, timestamps, IP addresses) is retained in memory for display.</li>
            <li>Parsed session data may be stored in your browser's IndexedDB to persist analysis results across page reloads. This storage is local to your device and is never synced or transmitted.</li>
          </ul>
        </Section>

        <Section title="3. Cookies & Local Storage">
          <p>
            OmniLog does not set any tracking cookies. The only browser storage used is:
          </p>
          <ul>
            <li><strong className="text-light">IndexedDB</strong> — stores parsed aggregation results locally so sessions persist across browser restarts. Data is stored only on your device.</li>
            <li><strong className="text-light">Service Worker Cache</strong> — caches the application shell for offline use. No user data is cached.</li>
          </ul>
        </Section>

        <Section title="4. Third-Party Services">
          <p>
            OmniLog uses <strong className="text-light">no third-party services</strong>. This includes:
          </p>
          <ul>
            <li>No analytics (Google Analytics, Mixpanel, Plausible, etc.)</li>
            <li>No error reporting (Sentry, Bugsnag, etc.)</li>
            <li>No CDN-loaded scripts or stylesheets</li>
            <li>No advertising networks</li>
            <li>No social media widgets</li>
          </ul>
          <p>
            The application is shipped with a Content Security Policy of <code className="text-info">connect-src 'none'</code>,
            which instructs the browser to block all outbound network connections at the network layer.
          </p>
        </Section>

        <Section title="5. Children's Privacy">
          <p>
            OmniLog does not collect any personal information from anyone, including children under the age of 13.
          </p>
        </Section>

        <Section title="6. Changes to This Policy">
          <p>
            If this privacy policy is ever updated, the revised version will be published on this page with an updated date.
            Since we collect no data, any changes will only ever clarify existing practices, not introduce new data collection.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            If you have questions about this privacy policy, you can reach us via the GitHub repository.
          </p>
        </Section>

      </div>
    </div>
  );
}
