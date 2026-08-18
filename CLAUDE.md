# OmniLog Analytics Engine — CLAUDE.md

## Project Overview

High-performance, privacy-first, client-side log analytics platform. Operates 100% in the browser with **zero outbound network requests**. Processes log files up to 100+ GB via Web Worker streaming.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build (tsc -b && vite build)
npm run preview    # Preview production build
```

TypeScript check: `npx tsc -b`

**Not `--noEmit`.** `tsconfig.json` is solution-style (`"files": []` plus `"references"`),
so `tsc --noEmit` resolves no input files and exits 0 without checking anything. It looks
like a passing typecheck and is not one.

```bash
npm run check      # contrast + design-token checkers (see Styling)
npm run lint       # 3 pre-existing errors is the current baseline
```

A green `npm run build` does **not** prove prerender health: `scripts/prerender.mjs` catches
per-route errors and continues, so the build stays green while a route fails. Read the
per-route `✓`/`✗` markers it prints.

## Architecture

### Two-Layer Design

**Main Thread (React)** — UI only. Never touches raw log data directly.
- Renders charts from aggregated data emitted by the Worker
- Manages drag & drop, filter state, tab switching
- Must stay at 60 FPS — no heavy computation allowed here

**Worker Thread** (`src/core/workers/logProcessor.worker.ts`) — all heavy computation.
- Reads file in 50 MB chunks via `File.slice()`
- Sniffs format from first 1 MB sample
- Parses line-by-line, emits `progress` and `partial` events progressively
- Sends final `done` event with full `AggregationResult`

### Parser Strategy Pattern

Format detection uses confidence scoring (0.0–1.0). The parser with the highest score above **0.85** wins. If none exceed the threshold, `generic.parser.ts` is used as fallback.

| Parser | Threshold | Signature |
|---|---|---|
| `nginx.parser.ts` | 0.92 | Combined Log Format |
| `apache.parser.ts` | 0.90 | Common Log + ErrorLog prefix |
| `ufw.parser.ts` | 0.95 | `[UFW BLOCK/ALLOW]` prefix |
| `syslog.parser.ts` | 0.88 | RFC 3164/5424 PRI header |
| `generic.parser.ts` | N/A (fallback) | Heuristic timestamp + severity + IP |

### Data Flow

```
File drop → useLogAnalytics hook → new Worker()
  → Worker: sniff (1MB) → postMessage({ type: 'sniff', format, confidence })
  → Worker: chunk loop → postMessage({ type: 'progress', percent, eta })
  → Worker: every 5 chunks → postMessage({ type: 'partial', aggregation })
  → Worker: done → postMessage({ type: 'done', aggregation })
  → Hook: updates React state → components re-render
  → IDB: saveSession() persists aggregation across browser restarts
```

## Key Constraints

### Zero-Egress (Log Data)
- **Never** add `fetch`, `axios`, `XMLHttpRequest`, or any network call that touches log data
- **Never** add error reporting (Sentry, etc.) or additional telemetry beyond what is listed below
- CSP is enforced via `public/_headers` (Cloudflare Workers Assets)

**Permitted third-party scripts (already configured in CSP and `index.html`):**
- `static.cloudflareinsights.com` — Cloudflare Web Analytics (auto-injected by Cloudflare, no code needed)

No advertising scripts. Do not add ad networks or re-broaden the CSP for them.

### Memory Budget
- Tab RAM must stay ≤ 500 MB regardless of file size
- Raw log strings are discarded from Worker memory after each chunk
- Only aggregated data (numbers, timestamps, IPs) crosses to Main Thread

### UI Thread
- No synchronous heavy loops on the main thread
- Filter operations on `entries[]` in `VirtualLogTable` are acceptable (runs on render, not in Worker) but must stay fast via `useMemo`

### Initial Bundle
Charts are behind a `React.lazy` boundary in `MainPage.tsx`, so chart.js must not be
loaded on first paint. Two things in `vite.config.ts` can silently break that:

- **Do not give chart.js a `manualChunks` name.** A named manual chunk gets a
  `<link rel="modulepreload">` in the entry HTML, so every route — including `/about`
  and `/privacy`, which never draw a chart — downloads and compiles it up front.
- **Match `manualChunks` on a full package-directory boundary.** A bare
  `id.includes('node_modules/react')` also matches `react-chartjs-2` and drags chart.js
  into the eagerly-preloaded `react-vendor` chunk.

After changing `manualChunks`, check `grep modulepreload dist/index.html` — only the
runtime, react, virtual, and idb vendor chunks belong there.

## Directory Structure

```
src/
├── types/log.types.ts          — All TypeScript interfaces
├── core/
│   ├── parsers/                — One file per log format
│   ├── workers/logProcessor.worker.ts
│   ├── dateFilter.ts           — Reducer/state for the dashboard date-range toolbar
│   └── idbStorage.ts           — IndexedDB CRUD
├── hooks/useLogAnalytics.ts    — Worker ↔ React state bridge
├── components/
│   ├── layout/                 — Navbar (uses react-router-dom Link/useNavigate)
│   ├── uploader/               — Dropzone
│   ├── landing/                — LandingView: the idle-state marketing view
│   ├── dashboard/              — Charts, StatCards, ProgressBar, DateRangeFilter
│   ├── table/                  — VirtualLogTable, FilterBar
│   └── pages/
│       ├── MainPage.tsx        — Main analytics UI (extracted from App.tsx)
│       ├── AboutUs.tsx
│       ├── ContactUs.tsx
│       ├── PrivacyPolicy.tsx
│       └── TermsAndConditions.tsx
└── assets/main.scss            — Bootstrap 5.3 dark theme
```

## Routing

React Router v6 (`BrowserRouter` in `main.tsx`, `Routes`/`Route` in `App.tsx`). Cloudflare Workers Assets handles SPA fallback via `"not_found_handling": "single-page-application"` in `wrangler.jsonc`.

`public/_redirects` exists only to 301 the removed `/blog` URLs to `/`. It is not needed for routing — without a rule, an unknown path falls through to the SPA handler and returns the app shell with a 200. Add a rule there when a public URL is retired, so search engines get a real 301 instead of a soft 404.

| Route | Component |
|---|---|
| `/` | `MainPage` — analytics UI |
| `/about` | `AboutUs` |
| `/contact` | `ContactUs` |
| `/privacy` | `PrivacyPolicy` |
| `/terms` | `TermsAndConditions` |

Each route is also prerendered to static HTML at build time by `scripts/prerender.mjs` — add a `ROUTES` entry there (and a `<url>` in `public/sitemap.xml`) when adding a new page.

The Navbar is rendered outside `<Routes>` so it persists on all pages. Analytics state (`useLogAnalytics`) lives in `App.tsx` and is passed as props to `MainPage` and `Navbar`.

## Adding a New Parser

1. Create `src/core/parsers/<format>.parser.ts`
2. Export `parse<Format>Line(raw: string, id: number): LogEntry | null`
3. Export `score<Format>(sample: string): number` — returns 0.0–1.0
4. Register it in `logProcessor.worker.ts`:
   - Import the score and parse functions
   - Add `['<format>', score<Format>(sample)]` to the `scores` array in `detectFormat()`
   - Add a `case '<format>'` in `parseLine()` switch

## Types Reference

Key interfaces in `src/types/log.types.ts`:

- `LogEntry` — single parsed log line (all fields nullable except `id` and `raw`)
- `AggregationResult` — full analysis output: `timeSeries`, `topIPs`, `statusDistribution`, `severityDistribution`, `entries[]`
- `WorkerEvent` — discriminated union: `sniff | progress | partial | done | error`
- `FilterState` — virtual table filter: `query`, `isRegex`, `severities`, date range

## Styling

### The token layer

All colour, spacing, type and radius values live in `src/assets/_tokens.scss` as SCSS
variables, re-exported as `--ol-*` CSS custom properties on `:root`. The SCSS variables
feed Bootstrap's overrides; the custom properties are what components read.

**No hex or rgb colour literal may exist outside `_tokens.scss`.** There are exactly two
sanctioned exceptions, both asserted by `npm run check:tokens`:

1. `TOKEN_FALLBACK` in `src/components/dashboard/Charts.tsx` — chart.js needs real colour
   strings, not `var()` references. It mirrors the tokens for the case where a chart
   renders without a DOM. Nothing reads it at runtime today, so nothing at runtime would
   ever reveal that it had drifted; the checker is what justifies keeping it at all.
2. `index.html`'s `theme-color` meta and the inline `<body>` background. Browser chrome
   cannot resolve a custom property, and the inline style is pre-CSS paint insurance. Both
   must equal `$ol-bg` — an inline style outranks `body { background: var(--ol-bg) }` in
   `main.scss`, so a stale value here repaints the whole app, and every contrast ratio in
   the design system is then measured against a ground the app never renders.

### Checkers

```bash
npm run check            # both of the below
npm run check:contrast   # 35 checks: 23 text at 4.5:1, 12 graphic at 3:1
npm run check:tokens     # TOKEN_FALLBACK + index.html mirror _tokens.scss
```

`check-contrast.mjs` enforces **two floors, because they are different requirements**:
**SC 1.4.3** (4.5:1) for anything carrying text, and **SC 1.4.11** (3:1) for non-text
graphical objects — chart fills, borders, focus rings. A third, **SC 2.5.8** (24×24 CSS px
target size), is not automatable and is checked by hand; note that an icon-only flex button
has no line-box strut, so it collapses to the SVG height, `line-height` never applies, and
it needs explicit `min-width`/`min-height`.

Most controls here do **not** clear 24×24, and are not meant to. Measured against the
live DOM, 52 targets are undersized — `.ol-row-toggle` (20×11), every `.ol-sort-btn`
(16.5px tall), every nav and footer link (18px tall). They pass under SC 2.5.8's
**spacing exception**: a 24px-diameter circle centred on each undersized target must not
intersect another target's circle. So when checking by hand, measure *centre-to-centre
distance*, not box size — a control under 24×24 is not automatically a defect, and
enlarging it is usually the wrong fix. The tightest spacing on the page is 36px, between
two adjacent row toggles, and that number is `ROW_HEIGHT` in `VirtualLogTable.tsx` (read
the comment there before changing it).

The checker composites alpha before comparing — a `--ol-*-fill` is `rgba($solid, 0.75)`, and
the solid's ratio says nothing about what reaches the screen. It is also **only** aware of
the pairings listed in `TEXT_CHECKS`; colours produced by `color-mix()` are invisible to it,
and `--ol-surface-2` is the tightest ground in the system. When you introduce a pairing, add
it — and negative-test that it can actually fail. A check that cannot fail is worthless.

### Primitives

`src/assets/_primitives.scss` holds the `.ol-*` classes that replaced Bootstrap's
components: `.ol-panel` (+ `--error`), `.ol-btn` (+ `--sm`, `--icon`, `--ghost`,
`--primary`), `.ol-chip` (+ severity and `--interactive` modifiers), `.ol-grid` /
`.ol-grid-cell`, `.ol-tabs` / `.ol-tab`, `.ol-toolbar`, `.ol-seg`, `.ol-input`,
`.ol-table-head`, `.ol-row`, `.ol-sort-btn`, `.ol-row-toggle`, `.ol-progress`. The
utilities `.ol-label`, `.ol-measure` and `.font-mono` live in `main.scss`.

Base surfaces: `--ol-bg` `#0a0c10` (body), `--ol-surface-1` `#12151b` (panels),
`--ol-surface-2` `#181c24` (toolbars, table head, resting chips).

Bootstrap is retained only for Reboot, the grid, and layout/spacing utilities. Two traps:
its spacing utilities are **`!important`**, so an inline `padding` alongside a `p-*` class
silently does nothing; and `p-4` is 1.5rem while `--ol-sp-4` is 1rem — prefer the token when
aligning against anything else built from tokens.

Icons are local SVG components in `src/components/icons.tsx`, generated by
`scripts/gen-icons.mjs`. The `bootstrap-icons` package is **not** a dependency; reinstall it
as a devDependency before regenerating.

No `dangerouslySetInnerHTML` anywhere — XSS prevention.
