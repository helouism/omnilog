/**
 * Asserts the color tokens meet WCAG AA, per
 * docs/superpowers/specs/2026-08-17-ui-redesign-design.md
 *
 * Two floors, because two kinds of token:
 *
 *   TEXT_CHECKS (4.5:1, SC 1.4.3) — solid `$token: #rrggbb` values that carry
 *     text.
 *
 *   GRAPHIC_CHECKS (3:1, SC 1.4.11) — the `--ol-*-fill` custom properties. These
 *     never carry text; they are bar bodies and doughnut segments. They are
 *     built as `rgba($solid, $alpha)`, so the ratio of the *solid* token says
 *     nothing about what actually reaches the screen — the alpha has to be
 *     composited over the surface first. Checking the solids alone was a blind
 *     spot: every fill passed at the solid's ratio while several composited to
 *     2.3:1.
 *
 * Run: node scripts/check-contrast.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/assets/_tokens.scss'), 'utf-8');

/** Pull `$name: #rrggbb;` declarations out of the SCSS source. */
function readTokens(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*\$([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * Pull `--ol-x-fill: #{rgba($solid, 0.75)};` declarations out of the :root block
 * and resolve each to the flat hex it composites to over `bg`.
 */
function readFills(text, tokens, bg) {
  const out = {};
  const re = /^\s*--(ol-[a-z0-9-]+):\s*#\{rgba\(\$([a-z0-9-]+),\s*([0-9.]+)\)\}\s*;/gm;
  for (const m of text.matchAll(re)) {
    const [, name, solid, alpha] = m;
    if (!name.endsWith('-fill')) continue; // washes are decorative, not 1.4.11 targets
    if (!tokens[solid]) { out[name] = null; continue; }
    out[name] = composite(tokens[solid], Number(alpha), bg);
  }
  return out;
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const rgb = hex => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Flatten `fg` at `alpha` over opaque `bg`, returning a hex string. */
function composite(fg, alpha, bg) {
  const [a, b] = [rgb(fg), rgb(bg)];
  return (
    '#' +
    a
      .map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;    // SC 1.4.3
const AA_GRAPHIC = 3;   // SC 1.4.11
const tokens = readTokens(src);

// Every token that carries text, and the surface it is read against.
const TEXT_CHECKS = [
  ['ol-text', 'ol-surface-1'],
  ['ol-text-dim', 'ol-surface-1'],
  ['ol-text-faint', 'ol-surface-1'],
  ['ol-text', 'ol-bg'],
  ['ol-text-dim', 'ol-bg'],
  ['ol-text-faint', 'ol-bg'],
  ['ol-accent', 'ol-bg'],
  ['ol-accent', 'ol-surface-1'],
  ['ol-sev-trace', 'ol-surface-1'],
  ['ol-sev-debug', 'ol-surface-1'],
  ['ol-sev-info', 'ol-surface-1'],
  ['ol-sev-warn', 'ol-surface-1'],
  ['ol-sev-error', 'ol-surface-1'],
  ['ol-sev-fatal', 'ol-surface-1'],
  ['ol-status-2xx', 'ol-surface-1'],
  ['ol-status-3xx', 'ol-surface-1'],
  ['ol-status-4xx', 'ol-surface-1'],
  ['ol-status-5xx', 'ol-surface-1'],
  ['ol-on-accent', 'ol-accent'],
];

let failed = 0;

for (const [fg, bg] of TEXT_CHECKS) {
  if (!tokens[fg]) { console.error(`MISSING token $${fg}`); failed++; continue; }
  if (!tokens[bg]) { console.error(`MISSING token $${bg}`); failed++; continue; }
  const ratio = contrast(tokens[fg], tokens[bg]);
  const ok = ratio >= AA_TEXT;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  text     ${fg} on ${bg}  ${ratio.toFixed(2)}:1`,
  );
}

// Chart fills are only ever painted on a panel, so surface-1 is the one ground
// they need to clear. Every -fill token found in :root is checked — the list
// cannot drift out of sync with the tokens because it is derived from them.
const FILL_BG = 'ol-surface-1';
const fills = readFills(src, tokens, tokens[FILL_BG]);
const fillNames = Object.keys(fills);

if (!fillNames.length) {
  console.error('MISSING: no --ol-*-fill tokens matched. Did the rgba() syntax change?');
  failed++;
}

for (const name of fillNames) {
  const flat = fills[name];
  if (!flat) { console.error(`UNRESOLVED fill --${name}`); failed++; continue; }
  const ratio = contrast(flat, tokens[FILL_BG]);
  const ok = ratio >= AA_GRAPHIC;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  graphic  ${name} on ${FILL_BG}  ${ratio.toFixed(2)}:1  (composites to ${flat})`,
  );
}

const total = TEXT_CHECKS.length + fillNames.length;
if (failed > 0) {
  console.error(
    `\n${failed} contrast check(s) failed ` +
    `(text floor ${AA_TEXT}:1, graphic floor ${AA_GRAPHIC}:1).`,
  );
  process.exit(1);
}
console.log(
  `\nAll ${total} contrast checks passed ` +
  `(${TEXT_CHECKS.length} text at ${AA_TEXT}:1, ${fillNames.length} graphic at ${AA_GRAPHIC}:1).`,
);
