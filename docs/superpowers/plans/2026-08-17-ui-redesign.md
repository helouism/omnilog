# OmniLog UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OmniLog's stock Bootstrap dark theme with a coherent "precision instrument" design system — a token layer, real typography, hairline grids, and semantic-only color — without touching any data path.

**Architecture:** A single SCSS token file is the sole source of truth for every color, size, and space value. It feeds Bootstrap's variable overrides *and* emits `--ol-*` CSS custom properties. A thin layer of `.ol-*` primitives consumes those properties; Bootstrap is retained only for its reset, grid, and neutral layout utilities. Chart colors are read from the same custom properties at runtime through a hook with an SSR-safe fallback.

**Tech Stack:** React 19, TypeScript, Vite 8, Sass, Bootstrap 5.3 (partial), chart.js 4 (lazy), react-router-dom 7, Cloudflare Workers Assets.

**Spec:** `docs/superpowers/specs/2026-08-17-ui-redesign-design.md`

**Branch:** `ui-redesign` (already created; spec commits `2dba30b` and `f2d1fbf` are on it)

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero-egress.** No `fetch`, `axios`, `XMLHttpRequest`, or any network call may be added. Fonts are self-hosted via npm; no CDN, no Google Fonts. `public/_headers` CSP must not be modified or broadened.
- **No `dangerouslySetInnerHTML`** anywhere. This includes the new icon components — use JSX `<path>` elements, never `innerHTML`.
- **Bootstrap variable overrides must appear above** the `@import 'bootstrap/scss/bootstrap'` line in `main.scss`.
- **`manualChunks` in `vite.config.ts` must not name a chunk for `chart.js` or `react-chartjs-2`**, and must keep matching on full package-directory boundaries. After any change, `dist/index.html` may contain `modulepreload` links for **only** the runtime, `react-vendor`, `virtual-vendor`, and `idb-vendor` chunks.
- **No hex color literal may exist outside `src/assets/_tokens.scss`**, with the single exception of the SSR fallback object in `Charts.tsx` (Task 10), which must be kept in sync by comment reference.
- **All text-bearing token pairs must meet WCAG AA (4.5:1).** Enforced by `scripts/check-contrast.mjs` (Task 1).
- **Dark theme only.** No light theme, no `prefers-color-scheme` blocks.
- **No changes** to `src/core/parsers/`, `src/core/workers/`, `src/core/idbStorage.ts`, `src/hooks/useLogAnalytics.ts`, or `src/types/log.types.ts`.
- **Node/npm:** run all commands from the repo root, `c:\Users\blegasul\Documents\PROJECTS\omnilog`.

### Verification commands (used throughout)

```bash
npx tsc --noEmit                 # must print nothing
npm run build                    # must succeed INCLUDING the prerender step
node scripts/check-contrast.mjs  # must exit 0
grep modulepreload dist/index.html
```

---

## Deviations from the spec (deliberate, approved)

1. **Icons move from Phase 8 to Commit 1.** The spec ordered icon replacement last, which would require rewriting every component twice — once to restyle, once to swap `bi-*` classes for components. Building `icons.tsx` first means each component is edited once. Commit 3 then only removes the dependency and dead files.
2. **Chart fills use 55% alpha over the surface, not 55% saturation.** Identical visual intent; `rgba()` is consumed natively by chart.js, composites correctly against any surface, and is mechanically verifiable. Hand-derived desaturated hexes are error-prone.
3. **`scripts/check-contrast.mjs` is added.** Not in the spec. The spec makes eleven numeric contrast claims and one was wrong on first pass; this makes them enforceable rather than aspirational.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/assets/_tokens.scss` | Sole source of truth: color, type, space, radius. Feeds Bootstrap overrides and emits `--ol-*` custom properties. |
| `src/assets/_primitives.scss` | `.ol-panel`, `.ol-grid`, `.ol-stat`, `.ol-chip`, `.ol-btn`, `.ol-tabs`, `.ol-toolbar`, `.ol-seg`. |
| `src/components/icons.tsx` | ~17 inline React SVG icon components, generated from `node_modules/bootstrap-icons`. |
| `src/components/layout/Footer.tsx` | Landing + static page footer. |
| `scripts/check-contrast.mjs` | Parses `_tokens.scss`, asserts WCAG ratios. |
| `scripts/gen-icons.mjs` | One-shot generator for `icons.tsx`. Committed for reproducibility. |

**Modified:** `src/assets/main.scss`, `src/main.tsx`, `src/App.tsx`, `package.json`, `vite.config.ts`, and all 14 components under `src/components/`.

**Deleted:** `public/icons.svg`.

---

## Commit 1 — Foundation (Tasks 1–5)

### Task 1: Contrast checker and token layer

This task has a genuine red-green cycle: the checker is written first, fails because the token file does not exist, then the token file makes it pass.

**Files:**
- Create: `scripts/check-contrast.mjs`
- Create: `src/assets/_tokens.scss`
- Modify: `package.json` (add `check:contrast` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `src/assets/_tokens.scss` exporting SCSS variables `$ol-bg`, `$ol-surface-1`, `$ol-surface-2`, `$ol-border-subtle`, `$ol-border`, `$ol-border-strong`, `$ol-text`, `$ol-text-dim`, `$ol-text-faint`, `$ol-accent`, `$ol-accent-alt`, plus severity/status maps; and a `:root` block emitting the matching `--ol-*` custom properties. Every later task consumes these by name.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-contrast.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node scripts/check-contrast.mjs
```

Expected: throws `ENOENT` on `src/assets/_tokens.scss` — the file does not exist yet.

- [ ] **Step 3: Write the token file**

Create `src/assets/_tokens.scss`:

```scss
// ─────────────────────────────────────────────────────────────────────────────
// OmniLog design tokens — THE single source of truth for color and scale.
//
// No hex literal may appear anywhere else in the codebase (the SSR fallback in
// Charts.tsx is the one documented exception).
//
// Contrast ratios are enforced by scripts/check-contrast.mjs. If you change a
// color here, run `npm run check:contrast` before committing.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Surfaces ────────────────────────────────────────────────────────────────
$ol-bg:             #0a0c10;
$ol-surface-1:      #12151b;
$ol-surface-2:      #181c24;
$ol-border-subtle:  #1e232c;
$ol-border:         #2a313c;
$ol-border-strong:  #3a434f;

// ─── Text (all three tiers clear WCAG AA at any size) ────────────────────────
$ol-text:           #e8ecf2;  // ~15.9:1 on surface-1
$ol-text-dim:       #98a2b0;  //   7.15:1
$ol-text-faint:     #7d8797;  //   5.09:1

// ─── Accent (from the brand mark gradient in public/favicon.svg) ─────────────
$ol-accent:         #58a6ff;  // 7.75:1 on bg — interactive/selected state ONLY
$ol-accent-alt:     #a371f7;  // logo gradient + FATAL severity ONLY

// ─── Severity ramp (cool recedes → warm advances) ────────────────────────────
$ol-sev-trace:      #78838f;  // 4.81:1
$ol-sev-debug:      #8b95a3;  // 6.10:1
$ol-sev-info:       #6e9fd4;  // 6.66:1
$ol-sev-warn:       #d9a441;  // 8.21:1
$ol-sev-error:      #e5534b;  // 4.99:1
$ol-sev-fatal:      #a371f7;  // 5.51:1
$ol-sev-unknown:    #7d8797;  // reuses text-faint

// ─── HTTP status ─────────────────────────────────────────────────────────────
$ol-status-2xx:     #3fb950;  // 7.20:1
$ol-status-3xx:     #6e9fd4;  // 6.66:1
$ol-status-4xx:     #d9a441;  // 8.21:1
$ol-status-5xx:     #e5534b;  // 4.99:1

// ─── Custom properties ───────────────────────────────────────────────────────
// Large areas (chart fills) use the same hue at 55% alpha rather than full
// saturation — a 4px legend swatch and a 300px bar must not read as the same
// weight of color. chart.js consumes rgba() natively.
:root {
  --ol-bg:            #{$ol-bg};
  --ol-surface-1:     #{$ol-surface-1};
  --ol-surface-2:     #{$ol-surface-2};
  --ol-border-subtle: #{$ol-border-subtle};
  --ol-border:        #{$ol-border};
  --ol-border-strong: #{$ol-border-strong};

  --ol-text:          #{$ol-text};
  --ol-text-dim:      #{$ol-text-dim};
  --ol-text-faint:    #{$ol-text-faint};

  --ol-accent:        #{$ol-accent};
  --ol-accent-alt:    #{$ol-accent-alt};

  --ol-sev-trace:     #{$ol-sev-trace};
  --ol-sev-debug:     #{$ol-sev-debug};
  --ol-sev-info:      #{$ol-sev-info};
  --ol-sev-warn:      #{$ol-sev-warn};
  --ol-sev-error:     #{$ol-sev-error};
  --ol-sev-fatal:     #{$ol-sev-fatal};
  --ol-sev-unknown:   #{$ol-sev-unknown};

  --ol-status-2xx:    #{$ol-status-2xx};
  --ol-status-3xx:    #{$ol-status-3xx};
  --ol-status-4xx:    #{$ol-status-4xx};
  --ol-status-5xx:    #{$ol-status-5xx};

  // Chart fills — 55% alpha of the matching hue.
  --ol-sev-trace-fill:   #{rgba($ol-sev-trace, 0.55)};
  --ol-sev-debug-fill:   #{rgba($ol-sev-debug, 0.55)};
  --ol-sev-info-fill:    #{rgba($ol-sev-info, 0.55)};
  --ol-sev-warn-fill:    #{rgba($ol-sev-warn, 0.55)};
  --ol-sev-error-fill:   #{rgba($ol-sev-error, 0.55)};
  --ol-sev-fatal-fill:   #{rgba($ol-sev-fatal, 0.55)};
  --ol-sev-unknown-fill: #{rgba($ol-sev-unknown, 0.55)};

  --ol-status-2xx-fill:  #{rgba($ol-status-2xx, 0.55)};
  --ol-status-3xx-fill:  #{rgba($ol-status-3xx, 0.55)};
  --ol-status-4xx-fill:  #{rgba($ol-status-4xx, 0.55)};
  --ol-status-5xx-fill:  #{rgba($ol-status-5xx, 0.55)};

  --ol-accent-fill:      #{rgba($ol-accent, 0.55)};
  --ol-accent-wash:      #{rgba($ol-accent, 0.08)};
  --ol-grid-line:        #{rgba(#ffffff, 0.05)};

  // ─── Type scale ───────────────────────────────────────────────────────────
  --ol-fs-2xs:  0.6875rem;  // 11px — badges, table meta
  --ol-fs-xs:   0.75rem;    // 12px — labels, captions
  --ol-fs-sm:   0.8125rem;  // 13px — table body, dense UI
  --ol-fs-base: 0.875rem;   // 14px — app default
  --ol-fs-md:   1rem;       // 16px — marketing body
  --ol-fs-lg:   1.125rem;   // 18px — section leads
  --ol-fs-xl:   1.375rem;   // 22px — section headings
  --ol-fs-2xl:  1.75rem;    // 28px — page titles
  --ol-fs-3xl:  clamp(2rem, 4.5vw, 3rem);

  // ─── Line height by role ──────────────────────────────────────────────────
  --ol-lh-heading: 1.15;
  --ol-lh-ui:      1.5;
  --ol-lh-prose:   1.7;
  --ol-lh-row:     1.45;

  // ─── Space scale ──────────────────────────────────────────────────────────
  --ol-sp-1: 0.25rem;
  --ol-sp-2: 0.5rem;
  --ol-sp-3: 0.75rem;
  --ol-sp-4: 1rem;
  --ol-sp-5: 1.5rem;
  --ol-sp-6: 2rem;
  --ol-sp-7: 3rem;
  --ol-sp-8: 4rem;

  // ─── Radius ───────────────────────────────────────────────────────────────
  --ol-r-sm: 4px;
  --ol-r-md: 6px;
  --ol-r-lg: 10px;
  --ol-r-xl: 14px;

  // ─── Measure ──────────────────────────────────────────────────────────────
  --ol-measure: 68ch;
  --ol-page-max: 1120px;
}
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
"check:contrast": "node scripts/check-contrast.mjs"
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run check:contrast
```

Expected: 18 `PASS` lines, then `All 18 contrast checks passed.`, exit 0.

If any line reads `FAIL`, **do not adjust the checker** — adjust the token value in `_tokens.scss` until it passes, then update the ratio comment beside it.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-contrast.mjs src/assets/_tokens.scss package.json
git commit -m "feat(ui): add design token layer with enforced contrast checks"
```

---

### Task 2: Self-hosted fonts

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx:4`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS font families `'Inter Variable'` and `'JetBrains Mono Variable'`, available globally. Task 3 wires them into `$font-family-base` / `$font-family-monospace`.

- [ ] **Step 1: Install the variable fonts**

```bash
npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

Note: `@fontsource/inter` (non-variable) stays a **devDependency**. `scripts/prerender.mjs:26-28` reads static `.woff` files from it for satori, which cannot consume variable fonts. Do not remove it.

- [ ] **Step 2: Import the latin subsets in `src/main.tsx`**

Replace line 4 (`import './assets/main.scss';`) with:

```tsx
import '@fontsource-variable/inter/latin.css';
import '@fontsource-variable/jetbrains-mono/latin.css';
import './assets/main.scss';
```

Font imports come **before** `main.scss` so the `@font-face` rules are registered before the styles referencing them.

These are client-only imports. `src/entry-server.tsx` imports `App` directly and never touches `main.tsx`, so SSR/prerender is unaffected.

- [ ] **Step 3: Verify the fonts resolve**

```bash
npm run build
ls dist/assets/ | grep -i -E "inter|jetbrains"
```

Expected: at least two `.woff2` files emitted.

- [ ] **Step 4: Verify the eager-chunk constraint still holds**

```bash
grep modulepreload dist/index.html
```

Expected: only the runtime, `react-vendor`, `virtual-vendor`, and `idb-vendor` chunks. **If a chart chunk appears, stop and investigate before continuing** — a CSS import in the wrong module graph is exactly how this regresses.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat(ui): self-host Inter Variable and JetBrains Mono Variable"
```

---

### Task 3: `main.scss` restructure and base typography

**Files:**
- Modify: `src/assets/main.scss` (full rewrite)

**Interfaces:**
- Consumes: `_tokens.scss` variables from Task 1; font families from Task 2.
- Produces: global base typography, Bootstrap configured from tokens, `.font-mono` utility. Later tasks assume `body` already carries Inter, tabular numerals, and the 14px base.

- [ ] **Step 1: Rewrite `src/assets/main.scss`**

```scss
// Tokens first — they define the SCSS variables the Bootstrap overrides below use.
@import 'tokens';

// ─── Bootstrap variable overrides (MUST precede the bootstrap import) ────────
$body-bg:                 $ol-bg;
$body-color:              $ol-text;
$card-bg:                 $ol-surface-1;
$card-border-color:       $ol-border;
$border-color:            $ol-border;
$input-bg:                $ol-surface-1;
$input-color:             $ol-text;
$input-border-color:      $ol-border;
$input-focus-border-color: $ol-accent;
$input-placeholder-color: $ol-text-faint;
$nav-link-color:          $ol-text-dim;
$primary:                 $ol-accent;

$font-family-sans-serif: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
$font-family-monospace:  'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Consolas, monospace;
$font-family-base:       $font-family-sans-serif;

@import 'bootstrap/scss/bootstrap';

@import 'primitives';

// ─── Global ──────────────────────────────────────────────────────────────────

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: $font-family-sans-serif;
  font-size: var(--ol-fs-base);
  line-height: var(--ol-lh-ui);
  background: var(--ol-bg);
  color: var(--ol-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  // Tabular numerals everywhere by default: this app is mostly numbers, and
  // proportional figures make counts jitter as they update during parsing.
  font-variant-numeric: tabular-nums;
}

// ─── Headings: optical tracking + balanced wrapping ──────────────────────────

h1, h2, h3, h4, h5, h6 {
  line-height: var(--ol-lh-heading);
  text-wrap: balance;
  font-weight: 600;
}

h1 { font-size: var(--ol-fs-3xl); letter-spacing: -0.021em; }
h2 { font-size: var(--ol-fs-2xl); letter-spacing: -0.021em; }
h3 { font-size: var(--ol-fs-xl);  letter-spacing: -0.014em; }

p { text-wrap: pretty; }

// ─── Links ───────────────────────────────────────────────────────────────────

a {
  color: var(--ol-accent);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

// ─── Focus: one visible ring everywhere ──────────────────────────────────────

:focus-visible {
  outline: 2px solid var(--ol-accent);
  outline-offset: 2px;
}

// ─── Scrollbars ──────────────────────────────────────────────────────────────

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--ol-border);
  border-radius: var(--ol-r-sm);
  &:hover { background: var(--ol-border-strong); }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

.font-mono { font-family: $font-family-monospace; }

.ol-measure { max-width: var(--ol-measure); }

.ol-label {
  font-size: var(--ol-fs-xs);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ol-text-faint);
}
```

Note what was deleted: `.dropzone-area`, `.drop-icon`, `.log-row`, `.text-purple`, `.bg-purple`, `.btn-xs`, `.navbar`, `.nav-tabs`, `.progress-container`, `.card`, `.col-sort-btn`. Their replacements live in `_primitives.scss` (Task 4). The app will look broken between Task 3 and Task 4 — that is expected; do not "fix" it inside this task.

- [ ] **Step 2: Create a placeholder `_primitives.scss` so the import resolves**

```bash
printf '// Primitives — populated in Task 4.\n' > src/assets/_primitives.scss
```

- [ ] **Step 3: Verify the build compiles**

```bash
npx tsc --noEmit && npm run build && npm run check:contrast
```

Expected: all three succeed. Sass must emit no errors about undefined variables.

- [ ] **Step 4: Commit**

```bash
git add src/assets/main.scss src/assets/_primitives.scss
git commit -m "refactor(ui): drive main.scss from tokens, add base typography"
```

---

### Task 4: Primitives

**Files:**
- Modify: `src/assets/_primitives.scss` (replace placeholder)

**Interfaces:**
- Consumes: `--ol-*` custom properties from Task 1.
- Produces: the class contract every component task depends on —
  `.ol-panel`, `.ol-panel-pad`, `.ol-grid`, `.ol-grid-cell`, `.ol-stat`, `.ol-stat-label`, `.ol-stat-value`, `.ol-chip`, `.ol-chip--{sev}`, `.ol-btn`, `.ol-btn--primary`, `.ol-btn--ghost`, `.ol-btn--sm`, `.ol-tabs`, `.ol-tab`, `.ol-toolbar`, `.ol-seg`, `.ol-seg-item`, `.ol-input`, `.ol-dropzone`, `.ol-row`, `.ol-table-head`.

- [ ] **Step 1: Write `src/assets/_primitives.scss`**

```scss
// ─────────────────────────────────────────────────────────────────────────────
// OmniLog primitives. All values come from custom properties in _tokens.scss.
// These replace Bootstrap's opinionated component classes (card, badge, btn,
// nav-tabs, table-dark). Bootstrap's grid and layout utilities are still used.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Panel: a genuinely independent surface (charts) ─────────────────────────

.ol-panel {
  background: var(--ol-surface-1);
  border: 1px solid var(--ol-border);
  border-radius: var(--ol-r-lg);
}

.ol-panel-pad { padding: var(--ol-sp-4); }

// ─── Hairline grid: cells sharing dividers inside one container ──────────────
// This is the core visual device. Cells never float; they share edges.

.ol-grid {
  display: grid;
  background: var(--ol-border-subtle); // shows through as the hairlines
  border: 1px solid var(--ol-border);
  border-radius: var(--ol-r-lg);
  overflow: hidden;
  gap: 1px;
}

.ol-grid-cell {
  background: var(--ol-surface-1);
  padding: var(--ol-sp-4);
}

// ─── Stat cell ───────────────────────────────────────────────────────────────

.ol-stat-label {
  font-size: var(--ol-fs-xs);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ol-text-faint);
  margin-bottom: var(--ol-sp-2);
}

.ol-stat-value {
  font-size: var(--ol-fs-2xl);
  font-weight: 600;
  letter-spacing: -0.021em;
  line-height: var(--ol-lh-heading);
  color: var(--ol-text);
  font-variant-numeric: tabular-nums;
}

.ol-stat-sub {
  font-size: var(--ol-fs-xs);
  color: var(--ol-text-dim);
  margin-top: var(--ol-sp-1);
}

// Only ever applied to the error stat, and only when the count is non-zero.
.ol-stat-value--alert { color: var(--ol-sev-error); }

// ─── Chip (replaces .badge) ──────────────────────────────────────────────────

.ol-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ol-sp-1);
  font-size: var(--ol-fs-2xs);
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: var(--ol-r-sm);
  border: 1px solid transparent;
  background: var(--ol-surface-2);
  color: var(--ol-text-dim);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@each $name in (trace, debug, info, warn, error, fatal, unknown) {
  .ol-chip--#{$name} {
    color: var(--ol-sev-#{$name});
    border-color: var(--ol-sev-#{$name});
    background: color-mix(in srgb, var(--ol-sev-#{$name}) 12%, transparent);
  }
}

.ol-chip--accent {
  color: var(--ol-accent);
  border-color: var(--ol-accent);
  background: var(--ol-accent-wash);
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

.ol-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ol-sp-2);
  font: inherit;
  font-size: var(--ol-fs-xs);
  font-weight: 500;
  padding: 0.35rem 0.7rem;
  border-radius: var(--ol-r-md);
  border: 1px solid var(--ol-border);
  background: var(--ol-surface-2);
  color: var(--ol-text-dim);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--ol-text);
    border-color: var(--ol-border-strong);
  }
  &:disabled { opacity: 0.5; cursor: default; }
}

.ol-btn--primary {
  background: var(--ol-accent);
  border-color: var(--ol-accent);
  color: #05070a;
  font-weight: 600;
  &:hover:not(:disabled) { filter: brightness(1.1); color: #05070a; }
}

.ol-btn--ghost {
  background: transparent;
  border-color: transparent;
  &:hover:not(:disabled) { background: var(--ol-surface-2); }
}

.ol-btn--sm { padding: 0.2rem 0.5rem; font-size: var(--ol-fs-2xs); }

.ol-btn--icon { padding: 0.3rem; }

// ─── Tabs ────────────────────────────────────────────────────────────────────

.ol-tabs {
  display: flex;
  gap: var(--ol-sp-1);
  border-bottom: 1px solid var(--ol-border);
}

.ol-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--ol-sp-2);
  font: inherit;
  font-size: var(--ol-fs-sm);
  font-weight: 500;
  padding: var(--ol-sp-3) var(--ol-sp-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--ol-text-faint);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover { color: var(--ol-text); }

  &.is-active {
    color: var(--ol-text);
    border-bottom-color: var(--ol-accent);
  }
}

// ─── Toolbar (sticky dashboard controls) ─────────────────────────────────────

.ol-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ol-sp-3);
  padding: var(--ol-sp-3) var(--ol-sp-4);
  background: var(--ol-surface-2);
  border-bottom: 1px solid var(--ol-border);
}

// ─── Segmented control (chart granularity) ───────────────────────────────────

.ol-seg {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: var(--ol-surface-2);
  border: 1px solid var(--ol-border);
  border-radius: var(--ol-r-md);
}

.ol-seg-item {
  font: inherit;
  font-size: var(--ol-fs-2xs);
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border: none;
  border-radius: var(--ol-r-sm);
  background: transparent;
  color: var(--ol-text-faint);
  cursor: pointer;

  &:hover { color: var(--ol-text); }
  &.is-active { background: var(--ol-border); color: var(--ol-text); }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

.ol-input {
  font: inherit;
  font-size: var(--ol-fs-xs);
  padding: 0.3rem 0.55rem;
  background: var(--ol-bg);
  border: 1px solid var(--ol-border);
  border-radius: var(--ol-r-md);
  color: var(--ol-text);
  color-scheme: dark;

  &::placeholder { color: var(--ol-text-faint); }
  &:focus {
    outline: none;
    border-color: var(--ol-accent);
    box-shadow: 0 0 0 3px var(--ol-accent-wash);
  }
}

// ─── Dropzone ────────────────────────────────────────────────────────────────

.ol-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ol-sp-3);
  width: 100%;
  padding: var(--ol-sp-7) var(--ol-sp-5);
  font: inherit;
  color: var(--ol-text);
  background: var(--ol-surface-1);
  border: 1px solid var(--ol-border);
  border-radius: var(--ol-r-xl);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:hover { border-color: var(--ol-border-strong); }

  &.is-active {
    border-color: var(--ol-accent);
    background: var(--ol-accent-wash);
  }
}

.ol-dropzone-icon {
  color: var(--ol-text-faint);
  transition: color 0.18s ease, transform 0.18s ease;

  .ol-dropzone.is-active & {
    color: var(--ol-accent);
    transform: translateY(-3px);
  }
}

// ─── Table ───────────────────────────────────────────────────────────────────

.ol-table-head {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0;
  padding: var(--ol-sp-2) var(--ol-sp-4);
  background: var(--ol-surface-2);
  border-bottom: 1px solid var(--ol-border);
  font-size: var(--ol-fs-2xs);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ol-text-faint);
}

.ol-row {
  border-bottom: 1px solid var(--ol-border-subtle);
  transition: background 0.1s ease;
  &:hover { background: var(--ol-surface-2); }
}

.ol-sort-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;

  &:hover { color: var(--ol-text); }
  &.is-active { color: var(--ol-text); }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit && npm run build && npm run check:contrast
```

Expected: all succeed.

> `color-mix(in srgb, ...)` is used in `.ol-chip--*`. It has full support in all browsers matching this project's `build.target: 'es2020'` baseline. If Sass errors on it, wrap the value in `#{}` to pass it through untouched.

- [ ] **Step 3: Commit**

```bash
git add src/assets/_primitives.scss
git commit -m "feat(ui): add .ol-* primitives replacing Bootstrap components"
```

---

### Task 5: Icon components

Generated from the installed `bootstrap-icons` package rather than hand-written, so the path data is exact.

**Files:**
- Create: `scripts/gen-icons.mjs`
- Create: `src/components/icons.tsx` (generated, then committed)

**Interfaces:**
- Consumes: `node_modules/bootstrap-icons/icons/*.svg`.
- Produces: named exports from `src/components/icons.tsx`, each a `React.FC<{ className?: string; size?: number }>`:
  `ChevronDown`, `ChevronRight`, `ChevronUp`, `ChevronExpand`, `Search`, `Regex`, `Download`, `XLg`, `X`, `Check`, `CloudArrowUp`, `ExclamationTriangle`, `BarChartLine`, `Table`, `ArrowLeft`, `Envelope`, `ShieldLock`.

- [ ] **Step 1: Write the generator**

Create `scripts/gen-icons.mjs`:

```js
/**
 * Generates src/components/icons.tsx from the bootstrap-icons package.
 *
 * Run: node scripts/gen-icons.mjs
 *
 * Committed so the icon set is reproducible, but it is a one-shot tool — the
 * generated file is the artefact that ships. bootstrap-icons is removed from
 * dependencies afterwards (Task 13); re-running this requires reinstalling it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = resolve(root, 'node_modules/bootstrap-icons/icons');

// [ComponentName, bootstrap-icons filename]
const ICONS = [
  ['ChevronDown',         'chevron-down'],
  ['ChevronRight',        'chevron-right'],
  ['ChevronUp',           'chevron-up'],
  ['ChevronExpand',       'chevron-expand'],
  ['Search',              'search'],
  ['Regex',               'regex'],
  ['Download',            'download'],
  ['XLg',                 'x-lg'],
  ['X',                   'x'],
  ['Check',               'check'],
  ['CloudArrowUp',        'cloud-arrow-up'],
  ['ExclamationTriangle', 'exclamation-triangle'],
  ['BarChartLine',        'bar-chart-line'],
  ['Table',               'table'],
  ['ArrowLeft',           'arrow-left'],
  ['Envelope',            'envelope'],
  ['ShieldLock',          'shield-lock'],
];

/** Pull the inner markup out of a bootstrap-icons SVG file. */
function innerMarkup(name) {
  const svg = readFileSync(resolve(iconDir, `${name}.svg`), 'utf-8');
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return body
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .trim();
}

const header = `// GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// Source: bootstrap-icons (MIT). Re-generate with \`node scripts/gen-icons.mjs\`
// after reinstalling bootstrap-icons as a devDependency.

interface IconProps {
  className?: string;
  size?: number;
}

function svgProps(size: number, className?: string) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
    className,
  } as const;
}
`;

const body = ICONS.map(([component, file]) => `
export function ${component}({ className, size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      ${innerMarkup(file).replace(/\n/g, '\n      ')}
    </svg>
  );
}`).join('\n');

writeFileSync(resolve(root, 'src/components/icons.tsx'), header + body + '\n');
console.log(`Generated src/components/icons.tsx with ${ICONS.length} icons.`);
```

- [ ] **Step 2: Run the generator**

```bash
node scripts/gen-icons.mjs
```

Expected: `Generated src/components/icons.tsx with 17 icons.`

- [ ] **Step 3: Verify it typechecks**

```bash
npx tsc --noEmit
```

Expected: no output.

If any icon's markup contains an attribute the generator did not convert to camelCase, TypeScript will flag it. Add the missing `.replace()` pair to `innerMarkup()` and re-run — do not hand-edit `icons.tsx`.

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-icons.mjs src/components/icons.tsx
git commit -m "feat(ui): add inline SVG icon components generated from bootstrap-icons"
```

---

## Commit 2 — Surfaces (Tasks 6–12)

> Every task in this commit follows the same shape: replace Bootstrap component classes with `.ol-*`, replace `<i className="bi bi-*" />` with the icon components from Task 5, delete inline `style` objects containing colors or font sizes, and delete every hex literal. Each task ends with `npx tsc --noEmit && npm run build`.

### Task 6: Navbar and Footer

**Files:**
- Modify: `src/components/layout/Navbar.tsx`
- Create: `src/components/layout/Footer.tsx`
- Modify: `src/App.tsx:14`

**Interfaces:**
- Consumes: `.ol-chip`, `.ol-btn` (Task 4); `XLg` (Task 5).
- Produces: `<Footer />`, a default-exportless named export rendered inside page scroll containers by Tasks 8 and 12.

- [ ] **Step 1: Rewrite the navbar into two zones**

Replace the `<nav>` element in `src/components/layout/Navbar.tsx` (lines 34–98). Keep `formatBytes`, `NAV_LINKS`, and the props interface unchanged. Replace `FORMAT_BADGE_COLOR` entirely — format is no longer color-coded, since format is not a severity.

```tsx
export function Navbar({ state, onReset }: NavbarProps) {
  const isActive = state.status !== 'idle';

  return (
    <nav
      className="d-flex align-items-center justify-content-between gap-3 px-3"
      style={{
        minHeight: 52,
        background: 'var(--ol-bg)',
        borderBottom: '1px solid var(--ol-border)',
      }}
    >
      {/* Left zone: identity + live instrument readout */}
      {/* minWidth:0 is required for the filename's text-truncate to work inside flex */}
      <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
        <Link
          to="/"
          className="d-flex align-items-center gap-2 text-decoration-none"
          style={{ color: 'var(--ol-text)', fontWeight: 600, letterSpacing: '-0.021em' }}
        >
          <img src="/favicon.svg" alt="" width={20} height={20} style={{ display: 'block' }} />
          OmniLog
        </Link>

        {isActive && state.fileName && (
          <span
            className="font-mono text-truncate d-none d-md-inline"
            style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}
          >
            {state.fileName}
            <span style={{ color: 'var(--ol-text-faint)' }}> · {formatBytes(state.fileSize)}</span>
          </span>
        )}

        {isActive && state.format !== 'unknown' && (
          <span className="ol-chip">
            {state.format.toUpperCase()}
            {state.confidence > 0 && (
              <span style={{ color: 'var(--ol-text-faint)' }}>
                {Math.round(state.confidence * 100)}%
              </span>
            )}
          </span>
        )}

        {state.status === 'parsing' && (
          <span className="ol-chip ol-chip--accent">{state.progress}%</span>
        )}
      </div>

      {/* Right zone: navigation — recedes while an analysis is active */}
      <div className="d-flex align-items-center gap-3">
        <div className="d-none d-sm-flex align-items-center gap-3">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-decoration-none"
              style={{
                fontSize: 'var(--ol-fs-xs)',
                color: isActive ? 'var(--ol-text-faint)' : 'var(--ol-text-dim)',
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {isActive && (
          <button
            type="button"
            className="ol-btn ol-btn--ghost ol-btn--icon"
            aria-label="Clear and reset"
            title="Clear and reset"
            onClick={onReset}
          >
            <XLg size={14} />
          </button>
        )}
      </div>
    </nav>
  );
}
```

Update the imports at the top of the file:

```tsx
import { Link } from 'react-router-dom';
import { XLg } from '../icons';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';
```

Delete the now-unused `FORMAT_BADGE_COLOR` constant.

- [ ] **Step 2: Create the footer**

Create `src/components/layout/Footer.tsx`:

```tsx
import { Link } from 'react-router-dom';

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
          <Link
            key={to}
            to={to}
            className="text-decoration-none"
            style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}
          >
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Remove the stale inline background in `App.tsx`**

In `src/App.tsx` line 14, replace:

```tsx
<div className="d-flex flex-column h-100 bg-dark text-white" style={{ background: '#0d1117' }}>
```

with:

```tsx
<div className="d-flex flex-column h-100">
```

`body` now supplies the background and text color (Task 3), and `#0d1117` is a forbidden hex literal.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Visual check**

```bash
npm run dev
```

Open `http://localhost:5173/about`. The navbar should show the wordmark on the left and three links on the right, with a hairline bottom border. No Bootstrap `navbar-dark`/`bg-dark` styling should remain.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/Footer.tsx src/App.tsx
git commit -m "feat(ui): two-zone navbar and new footer"
```

---

### Task 7: Dropzone

Strips the component from eleven stacked elements to three, per spec §5.

**Files:**
- Modify: `src/components/uploader/Dropzone.tsx` (replace the returned JSX, lines 42–114)

**Interfaces:**
- Consumes: `.ol-dropzone`, `.ol-dropzone-icon`, `.ol-panel` (Task 4); `CloudArrowUp`, `ExclamationTriangle` (Task 5).
- Produces: unchanged `DropzoneProps` contract — `onFile(file: File)`.

- [ ] **Step 1: Replace the JSX**

Keep all handler logic (lines 1–41) exactly as-is. Replace the `return (...)` block with:

```tsx
  return (
    <div className="w-100">
      <button
        type="button"
        className={`ol-dropzone ${isDragging ? 'is-active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="d-none"
          accept="*"
          aria-label="Upload log file"
          onChange={onInputChange}
        />

        <span className={`ol-dropzone-icon ${isDragging ? 'is-active' : ''}`}>
          <CloudArrowUp size={32} />
        </span>

        <span style={{ fontSize: 'var(--ol-fs-lg)', fontWeight: 600, letterSpacing: '-0.014em' }}>
          {isDragging ? 'Release to analyse' : 'Drop your log file here'}
        </span>

        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}>
          or click to browse — any format, any size
        </span>
      </button>

      {error && (
        <div
          className="ol-panel ol-panel-pad d-flex align-items-center gap-2 mt-3"
          role="alert"
          style={{ borderColor: 'var(--ol-sev-error)', color: 'var(--ol-sev-error)', fontSize: 'var(--ol-fs-sm)' }}
        >
          <ExclamationTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
```

Add to the imports:

```tsx
import { CloudArrowUp, ExclamationTriangle } from '../icons';
```

Everything removed — the five format badges, the two fine-print lines, and the three icon+label trust pairs — is replaced by a single text strip rendered by `LandingView` in Task 8. Do not re-add any of it here.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/uploader/Dropzone.tsx
git commit -m "feat(ui): strip dropzone to icon, instruction, and sub-line"
```

---

### Task 8: Landing page

**Files:**
- Modify: `src/components/landing/LandingView.tsx` (full rewrite)

**Interfaces:**
- Consumes: `.ol-grid`, `.ol-grid-cell`, `.ol-label` (Tasks 3–4); `<Dropzone />` (Task 7); `<Footer />` (Task 6).
- Produces: unchanged `LandingViewProps` contract — `onFile(file: File)`.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/components/landing/LandingView.tsx`:

```tsx
import { Dropzone } from '../uploader/Dropzone';
import { Footer } from '../layout/Footer';

const FEATURES: [string, string, string][] = [
  ['Privacy', 'Zero egress', 'Log files are read locally via the browser File API and never sent anywhere. The Content Security Policy blocks all outbound connections involving your data.'],
  ['Scale', '100 GB+ files', 'Read in 50 MB streaming chunks via a background Web Worker, keeping the UI at 60 FPS regardless of file size. Raw log strings are discarded after each chunk.'],
  ['Detection', 'Auto-detect format', 'Confidence scoring on the first 1 MB identifies NGINX, Apache, UFW, and RFC 3164/5424 syslog, with a generic heuristic parser as fallback.'],
  ['Analysis', 'Search and filter', 'Virtual scrolling handles millions of rows. Filter by severity, date range, or full regex. Sort any column. Export the filtered view to CSV.'],
];

const FORMATS: [string, string, string][] = [
  ['NGINX', 'Combined Log Format signature', 'IP, method, path, status, bytes, referer, user agent'],
  ['Apache', 'Common Log + ErrorLog prefix', 'IP, method, path, status, bytes, error level, message'],
  ['UFW', '[UFW BLOCK/ALLOW] prefix', 'SRC, DST, protocol, destination port, TCP flags'],
  ['Syslog', 'RFC 3164/5424 PRI header', 'Facility, severity, hostname, process, message'],
  ['Generic', 'Heuristic fallback', 'Timestamp, severity level, IP addresses, free-text message'],
];

const STEPS: [string, string][] = [
  ['Drop your file', 'Drag a log file onto the drop zone, or click to browse. Any format, any size. Files never leave your computer.'],
  ['Format detection', 'OmniLog reads the first 1 MB and scores it against each parser. The highest-confidence format wins.'],
  ['Stream and explore', 'The file is processed in 50 MB chunks on a background thread. Charts and the table fill in progressively as you search.'],
];

const TRUST = ['Zero egress', 'Auto-detects format', '100 GB+ files', 'No account'];

function Hero({ onFile }: { onFile: (file: File) => void }) {
  return (
    <section className="text-center">
      <h1 className="mb-3 mx-auto" style={{ maxWidth: '16ch' }}>
        Analyze your server logs privately, in your browser
      </h1>
      <p
        className="mx-auto mb-5"
        style={{
          maxWidth: '58ch',
          fontSize: 'var(--ol-fs-md)',
          lineHeight: 'var(--ol-lh-prose)',
          color: 'var(--ol-text-dim)',
        }}
      >
        Drop any log file and get instant charts, full-text search, and CSV export.
        No uploads, no servers, no accounts.
      </p>

      <div className="mx-auto" style={{ maxWidth: 620 }}>
        <Dropzone onFile={onFile} />
      </div>

      <div
        className="d-flex flex-wrap justify-content-center gap-3 mt-3"
        style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}
      >
        {TRUST.map((t, i) => (
          <span key={t}>
            {i > 0 && <span className="me-3" aria-hidden="true">·</span>}
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section
      className="ol-grid mt-5"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
    >
      {FEATURES.map(([label, title, body]) => (
        <div className="ol-grid-cell" key={title}>
          <div className="ol-label">{label}</div>
          <h3 className="mb-2" style={{ fontSize: 'var(--ol-fs-md)', fontWeight: 600 }}>{title}</h3>
          <p className="mb-0" style={{ fontSize: 'var(--ol-fs-sm)', lineHeight: 1.6, color: 'var(--ol-text-dim)' }}>
            {body}
          </p>
        </div>
      ))}
    </section>
  );
}

function SupportedFormats() {
  return (
    <section className="mt-5">
      <h2 className="mb-3" style={{ fontSize: 'var(--ol-fs-xl)' }}>Supported log formats</h2>
      <div className="ol-panel" style={{ overflowX: 'auto' }}>
        <table className="w-100 mb-0" style={{ fontSize: 'var(--ol-fs-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Format', 'Detection', 'Extracts'].map(h => (
                <th
                  key={h}
                  className="ol-label text-start"
                  style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', borderBottom: '1px solid var(--ol-border)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORMATS.map(([fmt, detect, extracts], i) => (
              <tr key={fmt} style={i > 0 ? { borderTop: '1px solid var(--ol-border-subtle)' } : undefined}>
                <td className="font-mono" style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text)' }}>{fmt}</td>
                <td style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{detect}</td>
                <td style={{ padding: 'var(--ol-sp-3) var(--ol-sp-4)', color: 'var(--ol-text-dim)' }}>{extracts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mt-5">
      <h2 className="mb-4" style={{ fontSize: 'var(--ol-fs-xl)' }}>How it works</h2>
      <div className="row g-4">
        {STEPS.map(([title, body], i) => (
          <div className="col-12 col-md-4" key={title}>
            <div style={{ borderTop: '1px solid var(--ol-border)', paddingTop: 'var(--ol-sp-3)' }}>
              <div className="ol-label mb-2">Step {i + 1}</div>
              <h3 className="mb-2" style={{ fontSize: 'var(--ol-fs-md)', fontWeight: 600 }}>{title}</h3>
              <p className="mb-0" style={{ fontSize: 'var(--ol-fs-sm)', lineHeight: 1.6, color: 'var(--ol-text-dim)' }}>
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface LandingViewProps {
  onFile: (file: File) => void;
}

/** Idle-state marketing view: shown until the user drops a log file. */
export function LandingView({ onFile }: LandingViewProps) {
  return (
    <div className="flex-grow-1 overflow-auto">
      <div style={{ maxWidth: 'var(--ol-page-max)', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
        <Hero onFile={onFile} />
        <FeatureGrid />
        <SupportedFormats />
        <HowItWorks />
        <Footer />
      </div>
    </div>
  );
}
```

Note: `<Footer />` sits **inside** the `overflow-auto` container, not as a sibling. Placing it outside would clip it under the global `html, body, #root { overflow: hidden }`.

Note also: the hero no longer wraps `Dropzone` in a fixed `height: 440` box. The dropzone now sizes to its content.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Visual check**

```bash
npm run dev
```

At `http://localhost:5173/`, confirm: hero wraps without a hard `<br />` at several window widths; the feature grid shows hairline dividers rather than four separate bordered boxes; the footer is reachable by scrolling.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingView.tsx
git commit -m "feat(ui): restructure landing page with hairline grids and footer"
```

---

### Task 9: Dashboard toolbar and stat strip

**Files:**
- Modify: `src/components/dashboard/DateRangeFilter.tsx`
- Modify: `src/components/dashboard/StatCards.tsx`

**Interfaces:**
- Consumes: `.ol-toolbar`, `.ol-input`, `.ol-btn`, `.ol-grid`, `.ol-grid-cell`, `.ol-stat-*` (Task 4).
- Produces: unchanged props contracts for both components.

- [ ] **Step 1: Rewrite `DateRangeFilter.tsx` as a sticky toolbar**

Replace lines 4–10 (the `INPUT_STYLE` constant — it contains two forbidden hex literals) and the entire returned JSX:

```tsx
import type { Dispatch } from 'react';
import type { DateFilter, DateAction } from '../../core/dateFilter';

interface DateRangeFilterProps {
  df: DateFilter;
  dispatch: Dispatch<DateAction>;
  /** Full timestamp span of the loaded data, as `datetime-local` values. */
  dataDateRange: { min: string; max: string };
  filteredTotal: number;
  overallTotal: number | undefined;
}

/** Sticky date-range toolbar above the dashboard. State is lifted so the page can re-aggregate. */
export function DateRangeFilter({ df, dispatch, dataDateRange, filteredTotal, overallTotal }: DateRangeFilterProps) {
  const isFiltered = !!(df.appliedFrom || df.appliedTo);
  const isDirty = df.dateFrom !== df.appliedFrom || df.dateTo !== df.appliedTo;
  const applyFilter = () => dispatch({ type: 'apply' });

  return (
    <div className="ol-toolbar">
      <span className="ol-label mb-0">Date range</span>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-from" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>From</label>
        <input
          id="date-from"
          type="datetime-local"
          className="ol-input"
          style={{ width: 190 }}
          value={df.dateFrom}
          min={dataDateRange.min}
          max={df.dateTo || dataDateRange.max}
          onChange={e => dispatch({ type: 'setFrom', v: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
      </div>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-to" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>To</label>
        <input
          id="date-to"
          type="datetime-local"
          className="ol-input"
          style={{ width: 190 }}
          value={df.dateTo}
          min={df.dateFrom || dataDateRange.min}
          max={dataDateRange.max}
          onChange={e => dispatch({ type: 'setTo', v: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
      </div>

      <button
        type="button"
        className={`ol-btn ol-btn--sm ${isDirty ? 'ol-btn--primary' : ''}`}
        onClick={applyFilter}
      >
        Apply
      </button>

      {isFiltered && (
        <button type="button" className="ol-btn ol-btn--sm ol-btn--ghost" onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      )}

      <span className="ms-auto" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
        {isFiltered ? (
          <>
            <span style={{ color: 'var(--ol-text)', fontWeight: 600 }}>{filteredTotal.toLocaleString()}</span>
            {' of '}{overallTotal?.toLocaleString()}{' entries'}
          </>
        ) : dataDateRange.min ? (
          <span className="font-mono">{dataDateRange.min} — {dataDateRange.max}</span>
        ) : null}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `StatCards.tsx` as a monochrome hairline strip**

Replace the full contents of `src/components/dashboard/StatCards.tsx`:

```tsx
import type { AggregationResult } from '../../types/log.types';

interface StatCardsProps {
  agg: AggregationResult;
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

/** Four-cell hairline strip. Deliberately monochrome — the only cell that ever
 *  takes color is Errors, and only when the count is non-zero. */
export function StatCards({ agg }: StatCardsProps) {
  const errorCount = agg.severityDistribution
    .filter(s => s.severity === 'ERROR' || s.severity === 'FATAL')
    .reduce((acc, s) => acc + s.count, 0);

  const cards: { label: string; value: string; sub?: string; alert?: boolean }[] = [
    {
      label: 'Total lines',
      value: agg.totalLines.toLocaleString(),
    },
    {
      label: 'Parsed',
      value: agg.parsedLines.toLocaleString(),
      sub: pct(agg.parsedLines, agg.totalLines),
    },
    {
      label: 'Errors / fatal',
      value: errorCount.toLocaleString(),
      sub: pct(errorCount, agg.parsedLines),
      alert: errorCount > 0,
    },
    {
      label: 'Format',
      value: agg.format.toUpperCase(),
    },
  ];

  return (
    <div className="ol-grid mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {cards.map(card => (
        <div className="ol-grid-cell" key={card.label}>
          <div className="ol-stat-label">{card.label}</div>
          <div className={`ol-stat-value ${card.alert ? 'ol-stat-value--alert' : ''}`}>
            {card.value}
          </div>
          {card.sub && <div className="ol-stat-sub">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DateRangeFilter.tsx src/components/dashboard/StatCards.tsx
git commit -m "feat(ui): sticky dashboard toolbar and monochrome stat strip"
```

---

### Task 10: Charts — token bridge and normalised heights

The most delicate task. The hook must stay inside the lazy chunk, and the fallback must exist or `npm run build` fails at the prerender step.

**Files:**
- Modify: `src/components/dashboard/Charts.tsx`

**Interfaces:**
- Consumes: `--ol-*` custom properties (Task 1); `.ol-panel`, `.ol-seg` (Task 4).
- Produces: unchanged `ChartsGrid` default export.

- [ ] **Step 1: Add the token hook at the top of `Charts.tsx`**

Insert after the existing imports, and add `useMemo` to the React import:

```tsx
/**
 * Chart palette, read from the CSS custom properties in _tokens.scss so there
 * is one source of truth for color.
 *
 * The fallback is REQUIRED, not defensive: scripts/prerender.mjs renders every
 * route through renderToString with no DOM, where getComputedStyle is
 * unavailable. Keep these values in sync with src/assets/_tokens.scss.
 */
const TOKEN_FALLBACK: Record<string, string> = {
  '--ol-text-dim': '#98a2b0',
  '--ol-text-faint': '#7d8797',
  '--ol-surface-1': '#12151b',
  '--ol-grid-line': 'rgba(255,255,255,0.05)',
  '--ol-accent': '#58a6ff',
  '--ol-accent-fill': 'rgba(88,166,255,0.55)',
  '--ol-sev-trace': '#78838f',
  '--ol-sev-debug': '#8b95a3',
  '--ol-sev-info': '#6e9fd4',
  '--ol-sev-warn': '#d9a441',
  '--ol-sev-error': '#e5534b',
  '--ol-sev-fatal': '#a371f7',
  '--ol-sev-unknown': '#7d8797',
  '--ol-sev-trace-fill': 'rgba(120,131,143,0.55)',
  '--ol-sev-debug-fill': 'rgba(139,149,163,0.55)',
  '--ol-sev-info-fill': 'rgba(110,159,212,0.55)',
  '--ol-sev-warn-fill': 'rgba(217,164,65,0.55)',
  '--ol-sev-error-fill': 'rgba(229,83,75,0.55)',
  '--ol-sev-fatal-fill': 'rgba(163,113,247,0.55)',
  '--ol-sev-unknown-fill': 'rgba(125,135,151,0.55)',
  '--ol-status-2xx-fill': 'rgba(63,185,80,0.55)',
  '--ol-status-3xx-fill': 'rgba(110,159,212,0.55)',
  '--ol-status-4xx-fill': 'rgba(217,164,65,0.55)',
  '--ol-status-5xx-fill': 'rgba(229,83,75,0.55)',
};

function useChartTokens(): (name: string) => string {
  return useMemo(() => {
    let computed: CSSStyleDeclaration | null = null;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      computed = getComputedStyle(document.documentElement);
    }
    return (name: string) => {
      const v = computed?.getPropertyValue(name).trim();
      return v || TOKEN_FALLBACK[name] || '#000000';
    };
  }, []);
}
```

- [ ] **Step 2: Replace every hardcoded color**

In each chart component, call `const t = useChartTokens();` at the top, then substitute:

| Current literal | Replacement |
|---|---|
| `'#adb5bd'` (legend/tick labels) | `t('--ol-text-dim')` |
| `'#6c757d'` (axis ticks) | `t('--ol-text-faint')` |
| `'rgba(255,255,255,0.05)'` and `'rgba(255,255,255,0.03)'` (grid) | `t('--ol-grid-line')` |
| `'#0d6efd'` (requests line border) | `t('--ol-accent')` |
| `'rgba(13,110,253,0.1)'` (requests fill) | `t('--ol-accent-fill')` |
| `'#dc3545'` (errors line border) | `t('--ol-sev-error')` |
| `'rgba(220,53,69,0.1)'` (errors fill) | `t('--ol-sev-error-fill')` |
| `'rgba(13,110,253,0.7)'` (top IPs bars) | `t('--ol-accent-fill')` |
| `'#1a1d21'` (doughnut/bar borders) | `t('--ol-surface-1')` |

Replace the two color maps (lines 188–191 and 231–237) with token lookups:

```tsx
const STATUS_FILL: Record<string, string> = {
  '2xx': t('--ol-status-2xx-fill'),
  '3xx': t('--ol-status-3xx-fill'),
  '4xx': t('--ol-status-4xx-fill'),
  '5xx': t('--ol-status-5xx-fill'),
};
```

```tsx
const SEVERITY_FILL: Record<string, string> = {
  FATAL: t('--ol-sev-fatal-fill'),
  ERROR: t('--ol-sev-error-fill'),
  WARN: t('--ol-sev-warn-fill'),
  INFO: t('--ol-sev-info-fill'),
  DEBUG: t('--ol-sev-debug-fill'),
  TRACE: t('--ol-sev-trace-fill'),
  UNKNOWN: t('--ol-sev-unknown-fill'),
};
```

Because these maps now depend on `t`, they must move **inside** the component bodies. Update the `?? '#6c757d'` fallbacks at lines 200 and 261 to `?? t('--ol-sev-unknown-fill')`.

- [ ] **Step 3: Normalise the card shells and heights**

In all four chart components, replace `<div className="card bg-dark border-secondary mb-3">` with `<div className="ol-panel ol-panel-pad h-100">`, and delete the inner `<div className="card-body p-3">` wrapper.

Replace each title with an icon-free heading:

```tsx
<div className="ol-label mb-3">Request / error trend</div>
```

Set chart container heights to `220` for `TimeSeriesChart` and `StatusDistributionChart`, and `200` for `TopIPsChart` and `SeverityChart`, replacing the current `180 / 180 / 200 / 160`.

- [ ] **Step 4: Replace the granularity toggle with a segmented control**

In `TimeSeriesChart`, replace the `btn-group` block (lines 126–137):

```tsx
<div className="ol-seg">
  {GRANULARITY_OPTIONS.map(opt => (
    <button
      key={opt.value}
      type="button"
      className={`ol-seg-item ${granularity === opt.value ? 'is-active' : ''}`}
      onClick={() => setGranularity(opt.value)}
    >
      {opt.label}
    </button>
  ))}
</div>
```

Keep the existing options array and state variable names exactly as they are.

- [ ] **Step 5: Update the grid to keep rows equal height**

Replace `ChartsGrid` (lines 240–249):

```tsx
export function ChartsGrid({ agg }: ChartsProps) {
  return (
    <div className="row g-3">
      <div className="col-12 col-lg-8"><TimeSeriesChart agg={agg} /></div>
      <div className="col-12 col-lg-4"><StatusDistributionChart agg={agg} /></div>
      <div className="col-12 col-lg-6"><TopIPsChart agg={agg} /></div>
      <div className="col-12 col-lg-6"><SeverityChart agg={agg} /></div>
    </div>
  );
}
```

The `h-100` added in Step 3 is what makes cards in a row match; the grid markup itself is unchanged.

- [ ] **Step 6: Verify the constraint that matters most**

```bash
npx tsc --noEmit && npm run build && grep modulepreload dist/index.html
```

Expected: build succeeds **including prerender** (this proves the SSR fallback works), and `modulepreload` lists only runtime, `react-vendor`, `virtual-vendor`, `idb-vendor`.

**If the build fails inside `[prerender]`, the fallback is not being reached** — check that `useChartTokens` guards on both `window` and `document`.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/Charts.tsx
git commit -m "feat(ui): read chart palette from tokens, normalise chart heights"
```

---

### Task 11: Log table and filter bar

**Files:**
- Modify: `src/components/table/FilterBar.tsx`
- Modify: `src/components/table/VirtualLogTable.tsx`

**Interfaces:**
- Consumes: `.ol-input`, `.ol-btn`, `.ol-chip--{sev}`, `.ol-row`, `.ol-table-head`, `.ol-sort-btn` (Task 4); `Search`, `Regex`, `Download`, `ChevronDown`, `ChevronRight`, `ChevronUp`, `ChevronExpand` (Task 5).
- Produces: unchanged props contracts for both.

- [ ] **Step 1: Rewrite `FilterBar.tsx`**

Replace `SEVERITY_COLOR` (lines 13–21) with a class-suffix map, and swap all Bootstrap classes:

```tsx
const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  FATAL: 'ol-chip--fatal',
  ERROR: 'ol-chip--error',
  WARN: 'ol-chip--warn',
  INFO: 'ol-chip--info',
  DEBUG: 'ol-chip--debug',
  TRACE: 'ol-chip--trace',
  UNKNOWN: 'ol-chip--unknown',
};
```

Replace the returned JSX:

```tsx
  return (
    <div
      className="d-flex flex-wrap align-items-center gap-3 px-4 py-2"
      style={{ background: 'var(--ol-surface-2)', borderBottom: '1px solid var(--ol-border)' }}
    >
      <div className="d-flex align-items-center gap-2">
        <span style={{ color: 'var(--ol-text-faint)' }}>
          {filter.isRegex ? <Regex size={14} /> : <Search size={14} />}
        </span>
        <input
          type="text"
          className="ol-input"
          style={{ width: 260 }}
          placeholder={filter.isRegex ? 'Regex pattern…' : 'Search logs…'}
          aria-label="Search logs"
          value={filter.query}
          onChange={e => onChange({ ...filter, query: e.target.value })}
        />
        <button
          type="button"
          className={`ol-btn ol-btn--sm ${filter.isRegex ? 'ol-btn--primary' : ''}`}
          aria-label="Toggle regex mode"
          title="Toggle regex mode"
          aria-pressed={filter.isRegex}
          onClick={() => onChange({ ...filter, isRegex: !filter.isRegex })}
        >
          <Regex size={13} />
        </button>
      </div>

      <div className="d-flex flex-wrap gap-1 align-items-center">
        {ALL_SEVERITIES.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={filter.severities.includes(s)}
            className={`ol-chip ${filter.severities.includes(s) ? SEVERITY_CLASS[s] : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => toggleSeverity(s)}
          >
            {s}
          </button>
        ))}
        {filter.severities.length > 0 && (
          <button
            type="button"
            className="ol-btn ol-btn--sm ol-btn--ghost"
            onClick={() => onChange({ ...filter, severities: [] })}
          >
            Clear
          </button>
        )}
      </div>

      <div className="d-flex align-items-center gap-3 ms-auto">
        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
          {isFiltered ? (
            <><span style={{ color: 'var(--ol-text)', fontWeight: 600 }}>{filteredRows.toLocaleString()}</span> of {totalRows.toLocaleString()}</>
          ) : (
            <>{totalRows.toLocaleString()} rows</>
          )}
        </span>
        <button type="button" className="ol-btn ol-btn--sm" title="Export filtered rows as CSV" onClick={onExportCsv}>
          <Download size={13} />CSV
        </button>
      </div>
    </div>
  );
```

Add to imports:

```tsx
import { Search, Regex, Download } from '../icons';
```

- [ ] **Step 2: Update `VirtualLogTable.tsx`**

Apply these substitutions:

- Line 71–74 sort indicators: replace the three `<i className="bi bi-chevron-*" />` with `<ChevronExpand size={11} />`, `<ChevronUp size={11} />`, `<ChevronDown size={11} />`.
- Line 171: replace `col-sort-btn ${active ? 'text-light' : 'text-muted'}` with `ol-sort-btn ${active ? 'is-active' : ''}`.
- Line 190: replace the header `<div>` classes with `className="ol-table-head"` and delete its inline `fontSize` style (the primitive sets it).
- Line 198: replace `className="flex-grow-1 text-muted"` with `className="flex-grow-1"`.
- Line 215: replace `log-row border-bottom border-secondary border-opacity-25 ${SEVERITY_CLASS[entry.severity]}` with `ol-row`. **Severity color moves to the chip only** — the row itself is no longer tinted.
- Line 234: replace the chevron `<i>` with `{isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}`.
- Line 236: change the id cell to `style={{ width: 55, flexShrink: 0, color: 'var(--ol-text-faint)' }}`.
- Line 237: add `className="font-mono"` to the timestamp cell.
- Line 239: replace `badge ${SEVERITY_BADGE[entry.severity]}` with `ol-chip ${SEVERITY_CHIP[entry.severity]}` and delete the inline `fontSize`.
- **Line 243: delete `text-info` from the IP cell** and add `className="font-mono"`.
- **Line 246: delete `text-warning` from the method cell.**
- Line 248: replace `flex-grow-1 text-truncate opacity-75` with `flex-grow-1 text-truncate font-mono` and add `style={{ color: 'var(--ol-text-dim)' }}`.

Define the chip map alongside the existing severity constants:

```tsx
const SEVERITY_CHIP: Record<SeverityLevel, string> = {
  FATAL: 'ol-chip--fatal',
  ERROR: 'ol-chip--error',
  WARN: 'ol-chip--warn',
  INFO: 'ol-chip--info',
  DEBUG: 'ol-chip--debug',
  TRACE: 'ol-chip--trace',
  UNKNOWN: 'ol-chip--unknown',
};
```

Delete the now-unused `SEVERITY_CLASS` and `SEVERITY_BADGE` maps. Add to imports:

```tsx
import { ChevronDown, ChevronRight, ChevronUp, ChevronExpand } from '../icons';
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run build
```

TypeScript will error on any severity map key you missed — that is the intended safety net.

- [ ] **Step 4: Commit**

```bash
git add src/components/table/FilterBar.tsx src/components/table/VirtualLogTable.tsx
git commit -m "feat(ui): restyle log table, drop decorative column color"
```

---

### Task 12: Progress bar, tabs, and static pages

**Files:**
- Modify: `src/components/dashboard/ProgressBar.tsx`
- Modify: `src/components/pages/MainPage.tsx:121-147` (tabs) and `:179-185` (error alert)
- Modify: `src/components/pages/AboutUs.tsx`, `ContactUs.tsx`, `PrivacyPolicy.tsx`, `TermsAndConditions.tsx`

**Interfaces:**
- Consumes: `.ol-tabs`, `.ol-tab`, `.ol-chip`, `.ol-panel` (Task 4); `<Footer />` (Task 6); icons (Task 5).
- Produces: no interface changes.

- [ ] **Step 1: Restyle `ProgressBar.tsx`**

Replace the outer wrapper and the progress element:

```tsx
  return (
    <div
      className="px-4 py-2"
      style={{ background: 'var(--ol-bg)', borderBottom: '1px solid var(--ol-border)' }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-dim)' }}>
          {isSniffing ? 'Detecting format…' : `Parsing ${state.fileName}`}
        </span>
        <div className="d-flex gap-3" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
          {!isSniffing && (
            <>
              <span>{formatBytes(state.processedBytes)} / {formatBytes(state.totalBytes)}</span>
              <span>{state.linesProcessed.toLocaleString()} lines</span>
              {state.eta > 0 && <span>{formatEta(state.eta)}</span>}
            </>
          )}
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--ol-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: '100%',
            background: 'var(--ol-accent)',
            transformOrigin: 'left',
            transform: `scaleX(${isSniffing ? 1 : state.progress / 100})`,
            transition: 'transform 0.3s ease',
            opacity: isSniffing ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
```

Remove the two `<i className="bi bi-*" />` icons — the adjacent text already says what is happening.

- [ ] **Step 2: Restyle the tabs in `MainPage.tsx`**

Replace lines 121–147:

```tsx
          {hasData && (
            <div className="px-4" style={{ background: 'var(--ol-bg)' }}>
              <div className="ol-tabs">
                <button
                  type="button"
                  className={`ol-tab ${tab === 'dashboard' ? 'is-active' : ''}`}
                  onClick={() => setTab('dashboard')}
                >
                  <BarChartLine size={14} />Dashboard
                </button>
                <button
                  type="button"
                  className={`ol-tab ${tab === 'table' ? 'is-active' : ''}`}
                  onClick={() => setTab('table')}
                >
                  <Table size={14} />Log table
                  <span className="ol-chip">{state.aggregation?.entries.length.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}
```

Replace the error alert at lines 179–185:

```tsx
          {state.status === 'error' && (
            <div
              className="ol-panel ol-panel-pad d-flex align-items-center gap-2 m-4"
              role="alert"
              style={{ borderColor: 'var(--ol-sev-error)' }}
            >
              <ExclamationTriangle size={14} className="flex-shrink-0" />
              <span style={{ color: 'var(--ol-sev-error)', fontSize: 'var(--ol-fs-sm)' }}>{state.error}</span>
              <button
                type="button"
                className="ol-btn ol-btn--sm ol-btn--ghost ms-auto"
                aria-label="Dismiss error"
                onClick={reset}
              >
                <XLg size={12} />
              </button>
            </div>
          )}
```

Also replace the `spinner-border` block at lines 166–171 and the Suspense fallback at line 161 with token-styled text:

```tsx
<div className="d-flex align-items-center justify-content-center h-100" style={{ color: 'var(--ol-text-faint)', fontSize: 'var(--ol-fs-sm)' }}>
  Processing…
</div>
```

Add to imports:

```tsx
import { BarChartLine, Table, ExclamationTriangle, XLg } from '../icons';
```

Also remove the `p-3` on line 151 and change it to `p-0` — the sticky toolbar must reach the container edges. Move padding to the content below it:

```tsx
<div className="h-100 overflow-auto">
  <DateRangeFilter … />
  <div className="p-4">
    <StatCards agg={filteredAgg} />
    <Suspense fallback={…}>
      <LazyChartsGrid agg={filteredAgg} />
    </Suspense>
  </div>
</div>
```

- [ ] **Step 3: Restyle the four static pages**

For each of `AboutUs.tsx`, `ContactUs.tsx`, `PrivacyPolicy.tsx`, `TermsAndConditions.tsx`, apply the same four changes:

1. Wrap content in the standard page shell:
   ```tsx
   <div className="flex-grow-1 overflow-auto">
     <div style={{ maxWidth: 'var(--ol-page-max)', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
       <div className="ol-measure">
         {/* existing content */}
       </div>
       <Footer />
     </div>
   </div>
   ```
2. Replace every inline `fontSize` with a `var(--ol-fs-*)` token.
3. Replace `text-muted` / `text-secondary` with `style={{ color: 'var(--ol-text-dim)' }}`.
4. Replace any `<i className="bi bi-*" />` with the matching icon component, or delete it if decorative.

Set prose paragraphs to `lineHeight: 'var(--ol-lh-prose)'`.

- [ ] **Step 4: Verify every route renders**

```bash
npx tsc --noEmit && npm run build && npm run dev
```

Visit `/`, `/about`, `/contact`, `/privacy`, `/terms`. Confirm each has a footer and no Bootstrap card styling remains.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ProgressBar.tsx src/components/pages/
git commit -m "feat(ui): restyle progress bar, tabs, and static pages"
```

---

## Commit 3 — Cleanup (Tasks 13–14)

### Task 13: Remove Bootstrap Icons and dead assets

**Files:**
- Modify: `src/main.tsx:5`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Delete: `public/icons.svg`

- [ ] **Step 1: Confirm no `bi-` class remains**

```bash
grep -rn "bi bi-\|bootstrap-icons" src/
```

Expected: **no output**. If anything matches, fix it before continuing — removing the dependency while a `bi-` class survives leaves an invisible broken icon.

- [ ] **Step 2: Remove the import**

Delete line 5 of `src/main.tsx`:

```tsx
import 'bootstrap-icons/font/bootstrap-icons.css';
```

- [ ] **Step 3: Uninstall and clean config**

```bash
npm uninstall bootstrap-icons
```

In `vite.config.ts`, delete the now-pointless block:

```ts
  optimizeDeps: {
    exclude: ['bootstrap-icons'],
  },
```

- [ ] **Step 4: Delete the dead asset**

```bash
git rm public/icons.svg
```

This file contains bluesky/discord/github symbols from an unrelated project and is referenced nowhere. Confirm first:

```bash
grep -rn "icons.svg" src/ index.html public/ scripts/
```

Expected: no output.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run build && npm run check:contrast
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(ui): drop bootstrap-icons font and dead icons.svg"
```

---

### Task 14: Final verification pass

**Files:** none modified unless a check fails.

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist node_modules/.vite
npm run build
```

Expected: succeeds, including `[prerender]` output for all five routes.

- [ ] **Step 2: Confirm the eager-chunk constraint**

```bash
grep modulepreload dist/index.html
```

Expected: entries for the runtime, `react-vendor`, `virtual-vendor`, and `idb-vendor` chunks **only**. No chart chunk.

- [ ] **Step 3: Confirm no chart code in the eager path**

```bash
grep -l "chartjs\|Chart.register" dist/assets/*.js
```

Expected: only the async chart chunk matches — it must not be any file referenced by a `modulepreload` link in `dist/index.html`.

- [ ] **Step 4: Record the bundle size delta**

```bash
du -sh dist/assets
ls -lS dist/assets/*.js dist/assets/*.css | head -20
```

Compare against `main` (`git stash` the branch or check out `main` into a scratch build). A **net reduction** is expected: the removed Bootstrap Icons font outweighs the two added variable fonts.

If the total grew, investigate before declaring done — the most likely cause is a font subset larger than `latin`.

- [ ] **Step 5: Confirm contrast**

```bash
npm run check:contrast
```

Expected: 18 passes.

- [ ] **Step 6: Confirm no stray hex literals**

```bash
grep -rn "#[0-9a-fA-F]\{6\}" src/ --include="*.tsx" --include="*.ts"
```

Expected: matches **only** inside the `TOKEN_FALLBACK` object in `Charts.tsx`. Any other match violates a global constraint.

- [ ] **Step 7: Confirm zero-egress is intact**

```bash
grep -rn "fetch(\|XMLHttpRequest\|axios" src/
git diff main -- public/_headers
```

Expected: no network calls introduced; `public/_headers` unchanged.

- [ ] **Step 8: Manual visual pass**

```bash
npm run dev
```

Check every route and every analytics state:

| Surface | What to confirm |
|---|---|
| `/` idle | Hero wraps cleanly at 3 widths; feature grid shows hairlines; footer reachable |
| `/` parsing | Progress bar animates; navbar shows filename, format chip, percent chip |
| `/` dashboard | Toolbar stays pinned while scrolling; stat strip is monochrome except a non-zero error count; chart cards in each row bottom out level |
| `/` log table | Header sticks; severity chips are the only colored cells; hover lifts rows |
| `/about`, `/contact`, `/privacy`, `/terms` | Prose measure capped; footer present |

- [ ] **Step 9: Commit any fixes and push**

```bash
git status                       # expect clean if nothing failed
git push -u origin ui-redesign
```

---

## Self-Review Notes

**Spec coverage** — every section of the spec maps to a task:

| Spec section | Task(s) |
|---|---|
| §3 Color (surfaces, text, accent, severity, status, fills) | 1 |
| §3 Stat cards monochrome | 9 |
| §4 Typography (fonts, scale, weight, tracking, measure) | 2, 3 |
| §5 Hairline grids | 4, 8, 9 |
| §5 Landing restructure | 7, 8 |
| §5 Dashboard (toolbar, stat strip, chart heights, segmented control) | 9, 10 |
| §5 Log table | 11 |
| §5 Chrome (two-zone navbar, footer) | 6, 8, 12 |
| §6 Icons | 5, 13 |
| §7 Chart color bridge | 10 |
| §8 Delivery in 3 commits | Task grouping |
| §9 Verification | Every task + 14 |
| §10 Non-goals | Global Constraints |

**Known ordering risk:** the app is visually broken between Task 3 (which deletes the old custom CSS) and Task 4 (which adds its replacement). This is intentional and called out in Task 3. Do not attempt to run the two tasks out of order.

**Type consistency:** `SEVERITY_CHIP` (Task 11, `VirtualLogTable.tsx`) and `SEVERITY_CLASS` (Task 11, `FilterBar.tsx`) are separate maps with identical values in different files — they are not shared because the two components have no common module and a shared constants file would be a new import edge for a seven-line map. Both are keyed by `SeverityLevel`, so TypeScript enforces completeness on each independently.
