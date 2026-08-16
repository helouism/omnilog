import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h5 className="fw-semibold mb-3" style={{ color: '#e6edf3' }}>{title}</h5>
      <div className="text-muted" style={{ lineHeight: 1.8, fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
}

export function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy — OmniLog';
  }, []);
  const navigate = useNavigate();
  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>

        <button type="button" className="btn btn-sm btn-outline-secondary mb-4" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2" />Back
        </button>

        <div className="mb-4">
          <h1 className="fw-bold mb-1" style={{ fontSize: '1.75rem' }}>Privacy Policy</h1>
          <span className="text-muted small">Last updated: August 2026</span>
        </div>

        <Section title="1. Information We Collect">
          <p>We ourselves collect <strong className="text-light">no information whatsoever</strong>.</p>
          <p>
            OmniLog is a fully client-side application. It has no backend and no database of its own.
            Your log files are read directly from your local filesystem via the browser's File API and are
            processed entirely within your browser tab using Web Workers. <strong className="text-light">Your log
            file contents are never uploaded or transmitted anywhere.</strong>
          </p>
          <p>
            The site does load a third-party analytics script (described in Section 4). It makes its own network
            requests and collects aggregate traffic data, but it has no access to the contents of the log files
            you analyse.
          </p>
        </Section>

        <Section title="2. Log File Processing">
          <p>When you drop a log file into OmniLog:</p>
          <ul>
            <li>The file is read locally by your browser; it is never uploaded to any server.</li>
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
            <li><strong className="text-light">IndexedDB</strong>: stores parsed aggregation results locally so sessions persist across browser restarts. Data is stored only on your device.</li>
          </ul>
        </Section>

        <Section title="4. Third-Party Services">
          <p>OmniLog uses one third-party service. It has no access to the contents of your log files.</p>

          <p><strong className="text-light">Cloudflare Web Analytics</strong></p>
          <p>
            We use Cloudflare Web Analytics to understand aggregate traffic patterns. It collects:
            page views, unique visitor counts, country of origin, referring URL, browser, and device type.
            It does <strong className="text-light">not</strong> use cookies, does not track individuals across sites,
            and does not collect personal data. Data is processed by Cloudflare in accordance with their{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-info">Privacy Policy</a>.
          </p>

          <p>
            Aside from the analytics service named above, no other third-party services are used.
            There is no advertising, no error reporting, and no social media widgets.
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
            If you have questions about this privacy policy, you can reach us by email at{' '}
            <a href="mailto:hendrikmahdi@gmail.com" className="text-info">hendrikmahdi@gmail.com</a>.
          </p>
        </Section>

      </div>
    </div>
  );
}
