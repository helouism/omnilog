# OmniLog Analytics Engine — CLAUDE.md

## Project Overview

High-performance, privacy-first, client-side log analytics platform. Operates 100% in the browser with **zero outbound network requests**. Processes log files up to 100+ GB via Web Worker streaming.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build (tsc -b && vite build)
npm run preview    # Preview production build
```

TypeScript check: `npx tsc --noEmit`

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

## Directory Structure

```
src/
├── types/log.types.ts          — All TypeScript interfaces
├── core/
│   ├── parsers/                — One file per log format
│   ├── workers/logProcessor.worker.ts
│   └── idbStorage.ts           — IndexedDB CRUD
├── hooks/useLogAnalytics.ts    — Worker ↔ React state bridge
├── components/
│   ├── layout/                 — Navbar (uses react-router-dom Link/useNavigate)
│   ├── uploader/               — Dropzone
│   ├── dashboard/              — Charts, StatCards, ProgressBar
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

- Bootstrap 5.3 via SCSS (`src/assets/main.scss`). Variable overrides must come **before** the `@import 'bootstrap/scss/bootstrap'` line.
- Dark theme base: `#0d1117` (body), `#161b22` (cards), `#30363d` (borders)
- Custom classes: `.dropzone-area`, `.dropzone-active`, `.log-row`, `.text-purple`, `.bg-purple`, `.btn-xs`
- No `dangerouslySetInnerHTML` anywhere — XSS prevention

