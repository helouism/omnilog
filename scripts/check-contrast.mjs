/**
 * Asserts every text-bearing color token meets WCAG AA (4.5:1) against its
 * intended background, per docs/superpowers/specs/2026-08-17-ui-redesign-design.md
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

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const tokens = readTokens(src);

// Every token that carries text, and the surface it is read against.
const CHECKS = [
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
for (const [fg, bg] of CHECKS) {
  if (!tokens[fg]) { console.error(`MISSING token $${fg}`); failed++; continue; }
  if (!tokens[bg]) { console.error(`MISSING token $${bg}`); failed++; continue; }
  const ratio = contrast(tokens[fg], tokens[bg]);
  const ok = ratio >= AA;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${fg} on ${bg}  ${ratio.toFixed(2)}:1`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} contrast check(s) failed (AA floor is ${AA}:1).`);
  process.exit(1);
}
console.log(`\nAll ${CHECKS.length} contrast checks passed.`);
