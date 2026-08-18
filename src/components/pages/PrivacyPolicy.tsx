import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft } from '../icons';
import { Footer } from '../layout/Footer';

/** Emphasis inside a --ol-text-dim prose block. Lifting to --ol-text is the only
 *  weight this design gives it; the old `.text-light` was a Bootstrap colour that
 *  no longer belongs to the palette. */
function Em({ children }: { children: ReactNode }) {
  return <strong style={{ color: 'var(--ol-text)' }}>{children}</strong>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-3" style={{ fontSize: 'var(--ol-fs-xl)' }}>{title}</h2>
      <div
        className="ol-measure"
        style={{
          fontSize: 'var(--ol-fs-md)',
          lineHeight: 'var(--ol-lh-prose)',
          color: 'var(--ol-text-dim)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy — OmniLog';
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

          <div className="mb-4">
            <h1 className="mb-1" style={{ fontSize: 'var(--ol-fs-2xl)' }}>Privacy Policy</h1>
            <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>Last updated: August 2026</span>
          </div>

          <Section title="1. Information We Collect">
            <p>We ourselves collect <Em>no information whatsoever</Em>.</p>
            <p>
              OmniLog is a fully client-side application. It has no backend and no database of its own.
              Your log files are read directly from your local filesystem via the browser's File API and are
              processed entirely within your browser tab using Web Workers. <Em>Your log
              file contents are never uploaded or transmitted anywhere.</Em>
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
              <li><Em>IndexedDB</Em>: stores parsed aggregation results locally so sessions persist across browser restarts. Data is stored only on your device.</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p>OmniLog uses one third-party service. It has no access to the contents of your log files.</p>

            <p><Em>Cloudflare Web Analytics</Em></p>
            <p>
              We use Cloudflare Web Analytics to understand aggregate traffic patterns. It collects:
              page views, unique visitor counts, country of origin, referring URL, browser, and device type.
              It does <Em>not</Em> use cookies, does not track individuals across sites,
              and does not collect personal data. Data is processed by Cloudflare in accordance with their{' '}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
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
              <a href="mailto:hendrikmahdi@gmail.com">hendrikmahdi@gmail.com</a>.
            </p>
          </Section>

        </main>
        <Footer />
      </div>
    </div>
  );
}
