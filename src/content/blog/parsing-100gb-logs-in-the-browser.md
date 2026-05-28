# How OmniLog Parses 100 GB Log Files Entirely in Your Browser

Most log analysis tools follow the same playbook: upload your logs to a server, process them in the cloud, show you a dashboard. Simple for the developer building it, potentially risky for you — your logs contain IP addresses, user agents, request paths, session tokens, and error stack traces. Handing them to a third party isn't just a privacy concern; in regulated industries it can be a compliance violation.

OmniLog takes the opposite approach. **Your logs never leave your machine.** The parser, the aggregation engine, and the entire analysis pipeline run inside your browser tab. This post explains how that works at scale — including files that are larger than the available RAM in your browser tab.

## The Two Problems with Browser-Side Parsing

Zero-egress means no `fetch`, no WebSockets, no remote service. Everything must happen locally. That's easy for a 10 MB log file. For a 100 GB access log from a high-traffic NGINX server, it requires real architecture.

Two problems kill naïve browser-based file processing immediately:

**1. Memory.** A 100 GB file loaded into a JavaScript string would immediately crash the tab. Browsers enforce per-tab RAM limits — typically 512 MB to 2 GB depending on the system, browser, and OS. You cannot hold the whole file in memory. You must stream it.

**2. UI jank.** Parsing millions of log lines synchronously on the main thread blocks all rendering. Scroll freezes, the progress indicator never updates, and the user is left staring at a frozen browser thinking it's hung. You must move the work off the main thread.

Web Workers solve both problems.

## The Worker Architecture

JavaScript is single-threaded — but Web Workers give you true parallel execution on a separate OS thread. The Worker has no DOM access, but it can receive messages, do heavy computation, and post results back to the main thread.

OmniLog's Worker (`src/core/workers/logProcessor.worker.ts`) owns the entire parsing pipeline. The main thread owns only the UI:

```
Main thread (React)             Worker thread
──────────────────              ─────────────────────────────────
Drop file       ──postMessage─▶  Receive File handle
                                 Read first 1 MB for format sniffing
                ◀─postMessage──  { type: 'sniff', format, confidence }

                                 Loop: slice 50 MB chunks
                ◀─postMessage──  { type: 'progress', percent, eta }
                                 Every 5 chunks emit partial results:
                ◀─postMessage──  { type: 'partial', aggregation }

                ◀─postMessage──  { type: 'done', aggregation }
```

The main thread never blocks. It renders progress updates in real time, keeps the UI at 60 FPS throughout parsing, and receives **aggregated data** — time series, IP rankings, status distributions — not raw strings.

## Streaming in 50 MB Chunks

The key insight is that the `File` object the browser hands you from a drag-and-drop event supports slicing without loading the whole file into memory:

```typescript
const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB
let offset = 0;

while (offset < file.size) {
  const slice = file.slice(offset, offset + CHUNK_SIZE);
  const text = await slice.text();
  parseChunk(text);          // parse and aggregate
  rawTextRef = null;         // release immediately — GC can reclaim it
  offset += CHUNK_SIZE;
}
```

Each 50 MB chunk is read, parsed line-by-line, aggregated into counters and maps, and then **discarded**. The raw strings never accumulate. Only the aggregated output — time-series buckets, IP counts, HTTP status tallies — grows as parsing progresses.

For a 100 GB file processed in 50 MB chunks, that's 2,000 iterations. Peak Worker memory usage is roughly 50 MB for the current chunk plus the growing aggregation structures. Realistically well under 200 MB regardless of file size.

## Format Detection by Confidence Scoring

OmniLog supports five log formats: NGINX, Apache, UFW, Syslog, and a generic fallback. Rather than asking the user to select a format before parsing (friction) or committing to one format at the start of parsing (unreliable), it auto-detects from the first megabyte using a confidence-scoring system.

Each parser module exports a `score(sample: string): number` function that returns a value from 0.0 to 1.0:

```typescript
const scores: [LogFormat, number][] = [
  ['nginx',   scoreNginx(sample)],
  ['apache',  scoreApache(sample)],
  ['ufw',     scoreUfw(sample)],
  ['syslog',  scoreSyslog(sample)],
];

// Highest scorer above threshold wins; generic is the fallback
scores.sort((a, b) => b[1] - a[1]);
const [format, confidence] = scores[0][1] > 0.85
  ? scores[0]
  : ['generic', 1.0];
```

How does each scorer work?

- **UFW**: Looks for `[UFW BLOCK]` or `[UFW ALLOW]` prefixes. If ≥90% of sampled lines match, score is 0.95. This is the most precise format — false positives are essentially impossible.
- **NGINX**: Checks for the Combined Log Format pattern: `IP - - [timestamp] "METHOD path HTTP/x.x" status bytes "referer" "ua"`. Validates field count, timestamp format, and quoted user-agent. Threshold: 0.92.
- **Apache**: Similar to NGINX but also recognises Apache's `[error]`/`[warn]` prefix in ErrorLog format. Threshold: 0.90.
- **Syslog**: Checks for RFC 3164 PRI headers (`<priority>`) or RFC 5424 structured data markers. Threshold: 0.88.
- **Generic**: Always selected as fallback. Uses heuristics — does the line contain a timestamp? An IPv4/IPv6 address? A severity keyword like `ERROR`, `WARN`, `INFO`? Extracts what it can.

The sniff phase runs on the first 1 MB only, taking a few milliseconds. Format detection is complete before the first chunk is parsed.

## The Memory Budget Enforcement

Raw strings are the enemy of large-file processing. OmniLog enforces a strict discipline inside the Worker:

1. **Per-chunk raw text**: Allocated via `slice.text()`, parsed, then released. A 50 MB chunk is gone from memory before the next one is read.

2. **`LogEntry` objects**: Each parsed line becomes a `LogEntry` — timestamp, IP, status code, severity, the original raw string. These are retained in an `entries[]` array for the table view. The raw string per entry is typically 100–300 bytes.

3. **Aggregation structures**: `Map` objects for time series, IP counts, and status distributions. These grow O(unique values), not O(total lines). A billion requests might hit only 100k unique IPs and 1440 minute-buckets — the maps stay tiny.

For files where `entries[]` would balloon past the memory budget (e.g., a 50 GB file with 500 million lines), OmniLog caps the retained entry count at a configurable maximum (default 500k). **Every line still contributes to the aggregations** — charts are always computed over the full file — but the table view shows a window of the most recent entries.

## Progressive Updates During Parsing

Waiting for a 100 GB file to finish before showing anything would be a terrible UX. OmniLog emits partial results every 5 chunks (every 250 MB):

```typescript
if (chunkIndex % 5 === 0) {
  self.postMessage({
    type: 'partial',
    aggregation: buildAggregation(entries, maps),
  });
}
```

The main thread receives these `partial` messages and updates all charts in real time. You can see the time-series graph grow, the top IPs list shift, and the status distribution update as parsing progresses. Long before the file is done, you often already have a useful picture of what's in it.

## Why Not WebAssembly?

A natural question: could this be faster with a Rust or C++ parser compiled to WebAssembly? Yes, probably 3–5x faster line parsing. But parsing isn't the bottleneck. For a 100 GB file, the dominant cost is reading 2,000 chunks off disk via the File API — that's I/O, not CPU. The JavaScript parser keeps the CPU busy enough that the read loop stays saturated. WASM would shave seconds off a task that takes minutes regardless.

WebAssembly also adds significant bundle size and build complexity for a marginal gain. The current TypeScript parser is simpler to maintain, audit, and extend with new formats.

## Try It Yourself

Drop any NGINX, Apache, UFW, or Syslog file onto [OmniLog](/) — or a plain text log with timestamps and severity levels. Files up to 100 GB work fine. Nothing leaves your browser.

The entire codebase is open and readable. If you're curious about the parser implementations, the Worker message protocol, or how IndexedDB session persistence works, [the source is on GitHub](https://github.com/blegasul/omnilog).
