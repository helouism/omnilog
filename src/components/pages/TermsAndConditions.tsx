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

export function TermsAndConditions() {
  const navigate = useNavigate();
  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>

        <button type="button" className="btn btn-sm btn-outline-secondary mb-4" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2" />Back
        </button>

        <div className="mb-4">
          <h1 className="fw-bold mb-1" style={{ fontSize: '1.75rem' }}>Terms &amp; Conditions</h1>
          <span className="text-muted small">Last updated: May 2026</span>
        </div>

        <p className="text-secondary mb-5" style={{ lineHeight: 1.8 }}>
          By accessing or using OmniLog, you agree to be bound by these terms. Please read them carefully.
          If you do not agree with any part of these terms, you may not use the application.
        </p>

        <Section title="1. Use of the Application">
          <p>OmniLog is provided as a free, client-side log analytics tool. You may use it to:</p>
          <ul>
            <li>Analyze log files from servers, applications, or network devices that you own or have explicit permission to access.</li>
            <li>Generate insights, charts, and exports for personal, professional, or commercial purposes.</li>
          </ul>
          <p>You may not use OmniLog to process log files obtained through unauthorized access to systems or networks.</p>
        </Section>

        <Section title="2. Intellectual Property">
          <p>
            OmniLog is open-source software. The source code, design, and documentation are the intellectual
            property of their respective contributors. You are free to use, modify, and distribute the software
            in accordance with its open-source license.
          </p>
          <p>
            The OmniLog name and logo may not be used to misrepresent the origin of the software or to imply
            official endorsement without permission.
          </p>
        </Section>

        <Section title="3. Disclaimer of Warranties">
          <p>
            OmniLog is provided <strong className="text-light">"as is"</strong> and <strong className="text-light">"as available"</strong>,
            without warranty of any kind, express or implied. This includes, but is not limited to, warranties
            of merchantability, fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            We do not warrant that the application will be error-free, uninterrupted, or that results obtained
            from its use will be accurate or reliable. Log parsing is heuristic-based and may produce incorrect
            results for non-standard or malformed log formats.
          </p>
        </Section>

        <Section title="4. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, OmniLog and its contributors shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages (including loss of data,
            loss of revenue, or business interruption) arising out of or in connection with your use of the application.
          </p>
          <p>
            Because OmniLog processes files entirely in your browser and makes no network requests, we have no
            access to your data and bear no responsibility for the contents of files you analyze.
          </p>
        </Section>

        <Section title="5. User Responsibilities">
          <p>You are solely responsible for:</p>
          <ul>
            <li>Ensuring you have the right to analyze the log files you process.</li>
            <li>Complying with applicable data protection laws (GDPR, CCPA, etc.) when processing logs that may contain personal data such as IP addresses or user identifiers.</li>
            <li>The accuracy of any conclusions drawn from the analysis results.</li>
          </ul>
        </Section>

        <Section title="6. Privacy">
          <p>
            Our Privacy Policy, which is incorporated into these Terms by reference, describes how the application
            handles your data. The short version: it doesn't. All processing is local to your browser.
          </p>
        </Section>

        <Section title="7. Modifications">
          <p>
            We reserve the right to update these Terms at any time. Changes will be posted on this page with
            an updated date. Continued use of the application after changes are posted constitutes acceptance
            of the revised Terms.
          </p>
        </Section>

        <Section title="8. Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with applicable law. Any disputes
            arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts.
          </p>
        </Section>

      </div>
    </div>
  );
}
