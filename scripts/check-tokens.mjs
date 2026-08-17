/**
 * Asserts the TOKEN_FALLBACK map in src/components/dashboard/Charts.tsx matches
 * the :root block in src/assets/_tokens.scss.
 *
 * Why this exists: TOKEN_FALLBACK is the one sanctioned exception to the rule
 * that no color literal may live outside _tokens.scss. It is a mirror for the
 * case where the chart chunk is ever rendered without a DOM, which does not
 * happen today (Charts is behind React.lazy and prerender only reaches the idle
 * LandingView). Nothing at runtime reads it, so nothing at runtime would ever
 * reveal that it had drifted. This check is the only thing that does, and it is
 * what justifies keeping the map at all.
 *
 * Comparison is numeric, not textual: Sass compiles `rgba($c, 0.75)` down to
 * 8-digit hex (#rrggbbaa), so `rgba(88,166,255,0.75)` and `#58a6ffbf` are the
 * same color written two ways. Alpha is compared with a 1/255 tolerance because
 * the hex form quantises it.
 *
 * Run: node scripts/check-tokens.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scss = readFileSync(resolve(root, 'src/assets/_tokens.scss'), 'utf-8');
const charts = readFileSync(
  resolve(root, 'src/components/dashboard/Charts.tsx'),
  'utf-8',
);

/** `$name: #rrggbb;` SCSS variables, for resolving rgba() references. */
function readVars(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*\$([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Every `--ol-*` custom property in :root, as an unresolved value string. */
function readCustomProps(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*(--ol-[a-z0-9-]+):\s*([^;]+);/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const vars = readVars(scss);

/** Resolve a token value to [r,g,b,a], following `#{...}` interpolation. */
function resolve4(raw) {
  let s = raw.trim();

  // #{$name} → the variable's hex
  const interp = s.match(/^#\{\$([a-z0-9-]+)\}$/);
  if (interp) s = vars[interp[1]] ?? s;

  // #{rgba($name, 0.75)} or #{rgba(#ffffff, 0.05)}
  const rgbaInterp = s.match(/^#\{rgba\(\s*(\$[a-z0-9-]+|#[0-9a-fA-F]{3,6})\s*,\s*([0-9.]+)\s*\)\}$/);
  if (rgbaInterp) {
    const base = rgbaInterp[1].startsWith('$')
      ? vars[rgbaInterp[1].slice(1)]
      : rgbaInterp[1];
    if (!base) return null;
    const c = resolve4(base);
    return c && [c[0], c[1], c[2], Number(rgbaInterp[2])];
  }

  let m;
  if ((m = s.match(/^#([0-9a-fA-F]{3,8})$/))) {
    let h = m[1].toLowerCase();
    if (h.length === 3 || h.length === 4) h = [...h].map(ch => ch + ch).join('');
    const n = p => parseInt(h.slice(p, p + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  if ((m = s.match(/^rgba?\(([^)]*)\)$/))) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(Number.isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

const same = (a, b) =>
  a && b &&
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] &&
  Math.abs(a[3] - b[3]) <= 1 / 255;

// ── Extract TOKEN_FALLBACK ───────────────────────────────────────────────────
const block = charts.match(/const TOKEN_FALLBACK[^{]*\{([\s\S]*?)\n\};/);
if (!block) {
  console.error('FAIL: could not find TOKEN_FALLBACK in Charts.tsx.');
  process.exit(1);
}
const fallback = new Map();
for (const m of block[1].matchAll(/'(--ol-[a-z0-9-]+)':\s*'([^']+)'/g)) {
  fallback.set(m[1], m[2]);
}

const props = readCustomProps(scss);
let failed = 0;

for (const [name, want] of fallback) {
  const declared = props[name];
  if (declared === undefined) {
    console.error(`FAIL  ${name}  in TOKEN_FALLBACK but NOT in _tokens.scss :root`);
    failed++;
    continue;
  }
  const a = resolve4(want);
  const b = resolve4(declared);
  if (!a) { console.error(`FAIL  ${name}  unparseable fallback '${want}'`); failed++; continue; }
  if (!b) { console.error(`FAIL  ${name}  unparseable token '${declared}'`); failed++; continue; }
  if (!same(a, b)) {
    console.error(
      `FAIL  ${name}  fallback '${want}' -> rgba(${a}) != token '${declared}' -> rgba(${b})`,
    );
    failed++;
    continue;
  }
  console.log(`PASS  ${name}`);
}

// Every token the charts actually ask for must be in the map, or the reader's
// last-resort branch becomes reachable.
const asked = new Set(
  [...charts.matchAll(/\bt\('(--[a-z0-9-]+)'\)/g)].map(m => m[1]),
);
for (const name of asked) {
  if (!fallback.has(name)) {
    console.error(`FAIL  ${name}  read via t() but missing from TOKEN_FALLBACK`);
    failed++;
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} token check(s) failed. TOKEN_FALLBACK in Charts.tsx has drifted ` +
    `from src/assets/_tokens.scss.`,
  );
  process.exit(1);
}
console.log(
  `\nAll ${fallback.size} fallback tokens match _tokens.scss; ` +
  `all ${asked.size} tokens read via t() are covered.`,
);
