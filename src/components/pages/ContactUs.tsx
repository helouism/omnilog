import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft } from '../icons';
import { Footer } from '../layout/Footer';

export function ContactUs() {
  useEffect(() => {
    document.title = 'Contact — OmniLog';
  }, []);

  return (
    <div className="flex-grow-1 overflow-auto">
      <div style={{ maxWidth: 'var(--ol-page-max)', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
        {/* Footer sits OUTSIDE <main> on purpose: a <footer> descended from
            <main> stops being exposed as the contentinfo landmark. */}
        <main>
          {/* .ol-btn on the Link, not .ol-navlink: this is a standalone control,
              and at --ol-fs-xs a bare link box is ~18px tall — under SC 2.5.8's
              24x24. .ol-btn's padding puts it at ~31px. */}
          <Link to="/" className="ol-btn mb-5">
            <ArrowLeft size={12} />Back to OmniLog
          </Link>

          <div className="mb-5">
            <h1 className="mb-2" style={{ fontSize: 'var(--ol-fs-2xl)' }}>Contact</h1>
            <p
              className="ol-measure mb-0"
              style={{
                fontSize: 'var(--ol-fs-md)',
                lineHeight: 'var(--ol-lh-prose)',
                color: 'var(--ol-text-dim)',
              }}
            >
              Questions, bug reports, or feature suggestions — here's where to reach us.
            </p>
          </div>

          <section className="ol-panel ol-panel-pad mb-4">
            <h2 className="mb-2" style={{ fontSize: 'var(--ol-fs-xl)' }}>Email</h2>
            <p className="mb-3" style={{ fontSize: 'var(--ol-fs-sm)', color: 'var(--ol-text-dim)' }}>
              For bug reports, feature requests, or anything else.
            </p>
            <a href="mailto:hendrikmahdi@gmail.com" className="font-mono" style={{ fontSize: 'var(--ol-fs-sm)' }}>
              hendrikmahdi@gmail.com
            </a>
          </section>

          <section className="ol-panel ol-panel-pad">
            <h2 className="mb-2" style={{ fontSize: 'var(--ol-fs-xl)' }}>Privacy concern?</h2>
            <p
              className="ol-measure mb-0"
              style={{
                fontSize: 'var(--ol-fs-md)',
                lineHeight: 'var(--ol-lh-prose)',
                color: 'var(--ol-text-dim)',
              }}
            >
              OmniLog is fully client-side. Your log files never leave your browser —
              there is no backend server, no database, and no upload endpoint.
              If you want to verify this, read our <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </section>

        </main>
        <Footer />
      </div>
    </div>
  );
}
