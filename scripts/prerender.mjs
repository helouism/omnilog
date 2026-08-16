/**
 * Postbuild prerender script.
 *
 * Run order in package.json: tsc -b && vite build && node scripts/prerender.mjs
 *
 * 1. Builds a Vite SSR bundle (vite.ssr.config.ts) → dist/server/entry-server.js
 * 2. For each route: renders app HTML, generates a unique OG image PNG, and
 *    injects both into the dist/index.html template.
 * 3. Writes dist/<route>/index.html + dist/<route>/og.png
 *
 * Cloudflare Workers Assets serves these static files directly — before the SPA
 * fallback — so crawlers receive real HTML instead of an empty <div id="root">.
 */

import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load Inter from @fontsource/inter (devDependency — no network call needed)
const fontDir = resolve(root, 'node_modules/@fontsource/inter/files');
const fontRegular = readFileSync(resolve(fontDir, 'inter-latin-400-normal.woff'));
const fontBold    = readFileSync(resolve(fontDir, 'inter-latin-700-normal.woff'));

// Minimal JSX-like helper for satori's object format (avoids a JSX compilation step)
function h(type, props, ...children) {
  const ch = children.length === 0 ? undefined
    : children.length === 1 ? children[0]
    : children;
  return { type, props: ch !== undefined ? { ...props, children: ch } : (props ?? {}) };
}

function adaptiveFontSize(text) {
  if (text.length <= 28) return '68px';
  if (text.length <= 44) return '56px';
  if (text.length <= 60) return '46px';
  return '40px';
}

// HTML-encode a string for safe injection into attribute values
function enc(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function generateOgImage(title, subtitle) {
  const svg = await satori(
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#0d1117',
        padding: '64px 80px',
        justifyContent: 'space-between',
      },
    },
      // Header: "OmniLog / <subtitle>"
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
        h('span', { style: { color: '#58a6ff', fontSize: '30px', fontWeight: 700 } }, 'OmniLog'),
        h('span', { style: { color: '#3d444d', fontSize: '30px', fontWeight: 400 } }, '/'),
        h('span', { style: { color: '#8b949e', fontSize: '26px', fontWeight: 400 } }, subtitle),
      ),
      // Title: big, bold, vertically centred
      h('div', {
        style: {
          display: 'flex',
          flexGrow: 1,
          alignItems: 'center',
          color: '#e6edf3',
          fontSize: adaptiveFontSize(title),
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          paddingTop: '16px',
          paddingBottom: '16px',
        },
      }, title),
      // Footer: domain + tagline
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        h('span', { style: { color: '#58a6ff', fontSize: '22px', fontWeight: 400 } }, 'omnilog.my.id'),
        h('span', { style: { color: '#3d444d', fontSize: '22px' } }, '·'),
        h('span', { style: { color: '#8b949e', fontSize: '22px', fontWeight: 400 } }, 'Privacy-first log analytics'),
      ),
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
      ],
    },
  );

  return new Resvg(svg).render().asPng();
}

const ROUTES = [
  {
    path: '/',
    title: 'OmniLog Analytics Engine — Browser-Based Log Analysis',
    description: 'High-performance, privacy-first log analytics that runs 100% in your browser. Parse NGINX, Apache, UFW & Syslog files up to 100 GB — your data never leaves your device.',
    subtitle: 'Analytics Engine',
    imageTitle: 'Browser-Based Log Analysis',
  },
  {
    path: '/about',
    title: 'About OmniLog — Privacy-First Browser Log Analytics',
    description: 'Learn about OmniLog: a high-performance, privacy-first log analytics platform that runs 100% in your browser. Zero uploads, multi-format support, Web Worker pipeline.',
    subtitle: 'About',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OmniLog',
    description: 'OmniLog privacy policy. Log files are processed entirely in your browser and never uploaded. No tracking cookies, no personal data collected.',
    subtitle: 'Privacy Policy',
  },
  {
    path: '/terms',
    title: 'Terms and Conditions — OmniLog',
    description: 'OmniLog terms and conditions of use. Client-side log analytics tool provided free of charge.',
    subtitle: 'Terms',
  },
  {
    path: '/contact',
    title: 'Contact — OmniLog',
    description: 'Get in touch with the OmniLog team. Report bugs, suggest features, or ask questions by email.',
    subtitle: 'Contact',
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

      // Derive image title: use override if provided, else strip " — OmniLog…" suffix
      const imageTitle = route.imageTitle
        ?? route.title.replace(/ [—–] .*$/, '');

      // Generate and save OG image
      const ogPng = await generateOgImage(imageTitle, route.subtitle);

      const outDir = route.path === '/'
        ? resolve(root, 'dist')
        : resolve(root, 'dist', route.path.slice(1));

      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'og.png'), ogPng);

      const pageUrl = route.path === '/'
        ? 'https://omnilog.my.id/'
        : `https://omnilog.my.id${route.path}`;
      const ogImageUrl = route.path === '/'
        ? 'https://omnilog.my.id/og.png'
        : `https://omnilog.my.id${route.path}/og.png`;

      let html = template
        // <title>
        .replace(/<title>[^<]*<\/title>/, `<title>${enc(route.title)}</title>`)
        // meta name="description"
        .replace(/(<meta name="description" content=")[^"]*(")/,
          `$1${enc(route.description)}$2`)
        // canonical
        .replace(/(<link rel="canonical" href=")[^"]*(")/,
          `$1${pageUrl}$2`)
        // Open Graph
        .replace(/(<meta property="og:title" content=")[^"]*(")/,
          `$1${enc(route.title)}$2`)
        .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,
          `$1${enc(route.description)}$2`)
        .replace(/(<meta property="og:url" content=")[^"]*(")/,
          `$1${pageUrl}$2`)
        .replace(/(<meta property="og:image" content=")[^"]*(")/,
          `$1${ogImageUrl}$2`)
        .replace(/(<meta property="og:image:alt" content=")[^"]*(")/,
          `$1${enc(imageTitle)}$2`)
        // Twitter Card
        .replace(/(<meta name="twitter:title" content=")[^"]*(")/,
          `$1${enc(route.title)}$2`)
        .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
          `$1${enc(route.description)}$2`)
        .replace(/(<meta name="twitter:image" content=")[^"]*(")/,
          `$1${ogImageUrl}$2`)
        .replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/,
          `$1${enc(imageTitle)}$2`)
        // SSR content
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

      writeFileSync(resolve(outDir, 'index.html'), html, 'utf-8');
      console.log(`[prerender]   ✓ ${route.path}`);
    } catch (err) {
      console.error(`[prerender]   ✗ ${route.path}: ${err.message}`);
      // Non-fatal — SPA fallback still works for this route
    }
  }

  console.log('[prerender] Done.');
}

main().catch(err => {
  console.error('[prerender] Fatal:', err);
  process.exit(1);
});
