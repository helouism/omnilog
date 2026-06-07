/**
 * Postbuild prerender script.
 *
 * Run order in package.json: tsc -b && vite build && node scripts/prerender.mjs
 *
 * 1. Builds a Vite SSR bundle (vite.ssr.config.ts) → dist/server/entry-server.js
 * 2. For each route: calls render(url), injects HTML into dist/index.html template
 * 3. Writes the result to dist/<route>/index.html
 *
 * Cloudflare Workers Assets serves these static files directly — before the SPA
 * fallback — so crawlers receive real HTML instead of an empty <div id="root">.
 */

import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const ROUTES = [
  {
    path: '/',
    title: 'OmniLog Analytics Engine — Browser-Based Log Analysis',
    description: 'High-performance, privacy-first log analytics that runs 100% in your browser. Parse NGINX, Apache, UFW & Syslog files up to 100 GB — your data never leaves your device.',
  },
  {
    path: '/blog',
    title: 'Blog — OmniLog',
    description: 'Deep dives into log analysis, browser performance, and privacy-first engineering.',
  },
  {
    path: '/blog/nginx-access-log-format',
    title: 'How to Read NGINX Access Log Format — OmniLog Blog',
    description: 'A field-by-field guide to the NGINX combined log format: remote address, status codes, referer, user agent, and how to analyse access logs with grep and awk.',
  },
  {
    path: '/blog/ufw-iptables-log-guide',
    title: 'Understanding UFW and iptables Log Entries — OmniLog Blog',
    description: 'Learn to read every field in a UFW firewall log line: SRC, DST, DPT, SPT, PROTO, TCP flags. Identify port scans, brute force attempts, and misconfigured services.',
  },
  {
    path: '/blog/apache-error-log-codes',
    title: 'Common Apache Error Log Codes Explained — OmniLog Blog',
    description: 'Understand Apache error log format, severity levels, and the most common errors: 403 Forbidden, 500 Internal Server Error, SSL issues, and rewrite loops.',
  },
  {
    path: '/blog/syslog-severity-levels',
    title: 'Linux Syslog Severity Levels: A Complete Guide — OmniLog Blog',
    description: 'All eight RFC 5424 syslog severity levels explained: from emergency (0) to debug (7), how rsyslog routes them, and how to filter with journalctl.',
  },
  {
    path: '/blog/linux-log-files-guide',
    title: 'Linux Log Files Explained: syslog, kern.log, auth.log — OmniLog Blog',
    description: 'A practical guide to every major log file under /var/log — what each one contains, how syslog routing and journald work, and commands to diagnose real problems.',
  },
  {
    path: '/blog/parsing-100gb-logs-in-the-browser',
    title: 'How OmniLog Parses 100 GB Log Files in Your Browser — OmniLog Blog',
    description: 'A technical deep dive into the Web Worker streaming architecture that lets OmniLog handle gigabyte-scale log files without any uploads.',
  },
  {
    path: '/about',
    title: 'About OmniLog — Privacy-First Browser Log Analytics',
    description: 'Learn about OmniLog: a high-performance, privacy-first log analytics platform that runs 100% in your browser. Zero uploads, multi-format support, Web Worker pipeline.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OmniLog',
    description: 'OmniLog privacy policy. Log files are processed entirely in your browser and never uploaded. No tracking cookies, no personal data collected.',
  },
  {
    path: '/terms',
    title: 'Terms and Conditions — OmniLog',
    description: 'OmniLog terms and conditions of use. Client-side log analytics tool provided free of charge.',
  },
  {
    path: '/contact',
    title: 'Contact — OmniLog',
    description: 'Get in touch with the OmniLog team. Report bugs, suggest features, or ask questions via email or follow us on Telegram.',
  },
];

async function main() {
  console.log('[prerender] Building SSR bundle…');
  await build({
    configFile: resolve(root, 'vite.ssr.config.ts'),
    logLevel: 'warn',
  });

  console.log('[prerender] Loading SSR entry…');
  const entryPath = resolve(root, 'dist/server/entry-server.js');
  // pathToFileURL handles Windows drive-letter paths correctly
  const { render } = await import(pathToFileURL(entryPath).href);

  const template = readFileSync(resolve(root, 'dist/index.html'), 'utf-8');

  for (const route of ROUTES) {
    try {
      const appHtml = render(route.path);

      let html = template
        .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
        .replace(
          /(<meta name="description" content=")[^"]*(")/,
          `$1${route.description}$2`
        )
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

      const outDir =
        route.path === '/'
          ? resolve(root, 'dist')
          : resolve(root, 'dist', route.path.slice(1));

      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html, 'utf-8');
      console.log(`[prerender]   ✓ ${route.path}`);
    } catch (err) {
      console.error(`[prerender]   ✗ ${route.path}: ${err.message}`);
      // Don't abort — a failing route is non-fatal; the SPA fallback still works
    }
  }

  console.log('[prerender] Done.');
}

main().catch(err => {
  console.error('[prerender] Fatal:', err);
  process.exit(1);
});
