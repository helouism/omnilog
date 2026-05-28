# OmniLog

Privacy-first log analytics that runs **100% in your browser**. Parse and visualize NGINX, Apache, UFW & Syslog files up to 100 GB — zero uploads, zero telemetry.

---

## Features

- **Zero-egress** — log data never leaves your machine. CSP enforces strict `script-src` and `connect-src` in production; outbound connections are limited to Cloudflare Analytics and Google AdSense.
- **Multi-format detection** — auto-detects NGINX, Apache, UFW, Syslog, and generic log formats using confidence scoring.
- **Streaming Web Worker** — files are read in 50 MB chunks on a background thread, keeping the UI at 60 FPS regardless of file size.
- **Live dashboard** — request/error trend, HTTP status distribution, top 10 source IPs, severity breakdown, and stat cards — all update progressively as the file is parsed.
- **Global date filter** — filter the entire dashboard (all charts + stat cards) by a custom time range, applied on demand.
- **Virtual log table** — renders millions of rows without DOM overhead via `@tanstack/react-virtual`. Supports full-text search, regex, severity filter, and sortable columns.
- **CSV export** — export filtered & sorted log entries to CSV in one click.
- **IndexedDB session persistence** — last parsed file is restored on page reload.
- **Blog** — static markdown-based blog at `/blog`; posts are bundled at build time via `import.meta.glob`, rendered with `react-markdown` + `remark-gfm`.

## Supported Formats

| Format | Detection signature |
|---|---|
| NGINX | Combined Log Format |
| Apache | Common Log + ErrorLog prefix |
| UFW | `[UFW BLOCK/ALLOW]` prefix |
| Syslog | RFC 3164 / 5424 PRI header |
| Generic | Heuristic timestamp + severity + IP |

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build
npm run preview   # preview production build
```

TypeScript check:
```bash
npx tsc --noEmit
```

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19, Bootstrap 5.3 (SCSS) |
| Routing | React Router v6 |
| Charts | Chart.js 4, react-chartjs-2 |
| Virtual list | @tanstack/react-virtual |
| Blog | react-markdown, remark-gfm |
| Bundler | Vite 8 |
| Language | TypeScript 6 |
| PWA | vite-plugin-pwa + Workbox |
| Storage | IndexedDB via `idb` |

## Architecture

```
File drop → useLogAnalytics hook → Web Worker
  → sniff (1 MB sample) → detect format + confidence
  → chunk loop (50 MB) → parse line-by-line
  → every 5 chunks → postMessage partial aggregation
  → done → postMessage full AggregationResult
  → React state → charts re-render
  → IndexedDB → session persisted
```

**Main thread** handles only UI — rendering charts from aggregated data emitted by the Worker. Raw log strings are discarded from Worker memory after each chunk; only numbers, timestamps, and IPs cross to the main thread.

**Global date filter** re-aggregates all metrics from `entries[]` on the main thread via `useMemo` — a single O(n) pass, applied only on explicit user action (Enter or Apply button).

## Privacy

- No `fetch`, `axios`, or `XMLHttpRequest` in application code — log data never leaves the browser
- All app assets are bundled locally; no CDN dependencies for the app shell
- Service Worker uses Cache-First for all app shell assets
- **Cloudflare Web Analytics** — cookieless, aggregate traffic metrics only (page views, country, browser). No personal data collected.
- **Google AdSense** — serves display ads; may use cookies for ad personalisation per [Google's Privacy Policy](https://policies.google.com/privacy)

## License

MIT
