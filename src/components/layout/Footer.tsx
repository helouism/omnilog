import { NavLink } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
];

/** Landing + static page footer. Not rendered on the dashboard, which is a
 *  full-height overflow:hidden region — the navbar carries links there. */
export function Footer() {
  return (
    <footer
      className="d-flex flex-wrap align-items-center justify-content-between gap-3 px-4 py-4 mt-5"
      style={{ borderTop: '1px solid var(--ol-border)' }}
    >
      <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
        OmniLog — log analytics that never leaves your browser.
      </span>
      <div className="d-flex flex-wrap gap-4">
        {FOOTER_LINKS.map(({ label, to }) => (
          <NavLink key={to} to={to} className="ol-navlink">
            {label}
          </NavLink>
        ))}
      </div>
    </footer>
  );
}
