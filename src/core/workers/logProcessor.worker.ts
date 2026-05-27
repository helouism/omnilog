import type {
  LogEntry,
  LogFormat,
  AggregationResult,
  WorkerMessage,
  IPCount,
  StatusCount,
  SeverityCount,
  TimeSeriesBucket,
  SeverityLevel,
} from '../../types/log.types';

import { parseNginxLine, scoreNginx } from '../parsers/nginx.parser';
import { parseApacheLine, scoreApache } from '../parsers/apache.parser';
import { parseUfwLine, scoreUfw } from '../parsers/ufw.parser';
import { parseSyslogLine, scoreSyslog } from '../parsers/syslog.parser';
import { parseGenericLine } from '../parsers/generic.parser';

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB
const SAMPLE_SIZE = 1 * 1024 * 1024; // 1 MB
const CONFIDENCE_THRESHOLD = 0.85;
const PARTIAL_EMIT_INTERVAL = 5; // emit partial every N chunks

// ─── Format detection ────────────────────────────────────────────────────────

function detectFormat(sample: string): { format: LogFormat; confidence: number } {
  const scores: [LogFormat, number][] = [
    ['nginx', scoreNginx(sample)],
    ['apache', scoreApache(sample)],
    ['ufw', scoreUfw(sample)],
    ['syslog', scoreSyslog(sample)],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [format, confidence] = scores[0];

  if (confidence >= CONFIDENCE_THRESHOLD) {
    return { format, confidence };
  }
  return { format: 'generic', confidence: 0 };
}

// ─── Line parser dispatch ────────────────────────────────────────────────────

function parseLine(raw: string, id: number, format: LogFormat): LogEntry {
  let entry: LogEntry | null = null;
  switch (format) {
    case 'nginx':   entry = parseNginxLine(raw, id); break;
    case 'apache':  entry = parseApacheLine(raw, id); break;
    case 'ufw':     entry = parseUfwLine(raw, id); break;
    case 'syslog':  entry = parseSyslogLine(raw, id); break;
  }
  return entry ?? parseGenericLine(raw, id);
}

// ─── Aggregation helpers ─────────────────────────────────────────────────────

function minuteBucket(ts: Date): string {
  return ts.toISOString().slice(0, 16); // "2024-01-01T10:05"
}

function buildAggregation(
  entries: LogEntry[],
  format: LogFormat,
  confidence: number,
  totalLines: number,
  errorLines: number,
): AggregationResult {
  const tsMap = new Map<string, { requests: number; errors: number }>();
  const ipMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const severityMap = new Map<SeverityLevel, number>();

  for (const e of entries) {
    if (e.timestamp) {
      const bucket = minuteBucket(e.timestamp);
      const prev = tsMap.get(bucket) ?? { requests: 0, errors: 0 };
      prev.requests++;
      if (e.severity === 'ERROR' || e.severity === 'FATAL' || (e.status != null && e.status >= 500)) {
        prev.errors++;
      }
      tsMap.set(bucket, prev);
    }

    if (e.ip) ipMap.set(e.ip, (ipMap.get(e.ip) ?? 0) + 1);

    if (e.status != null) {
      const key = `${Math.floor(e.status / 100)}xx`;
      statusMap.set(key, (statusMap.get(key) ?? 0) + 1);
    }

    severityMap.set(e.severity, (severityMap.get(e.severity) ?? 0) + 1);
  }

  const timeSeries: TimeSeriesBucket[] = Array.from(tsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([timestamp, v]) => ({ timestamp, ...v }));

  const topIPs: IPCount[] = Array.from(ipMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const statusDistribution: StatusCount[] = Array.from(statusMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([status, count]) => ({ status, count }));

  const severityDistribution: SeverityCount[] = Array.from(severityMap.entries())
    .map(([severity, count]) => ({ severity, count }));

  return {
    format,
    confidence,
    totalLines,
    parsedLines: entries.length,
    errorLines,
    timeSeries,
    topIPs,
    statusDistribution,
    severityDistribution,
    entries,
  };
}

// ─── Main processing loop ────────────────────────────────────────────────────

async function processFile(file: File): Promise<void> {
  const totalBytes = file.size;
  let processedBytes = 0;
  let lineId = 0;
  let totalLines = 0;
  let errorLines = 0;
  const allEntries: LogEntry[] = [];

  // Step 1: Sniff format from first 1MB
  const sampleBlob = file.slice(0, SAMPLE_SIZE);
  const sampleText = await sampleBlob.text();
  const { format, confidence } = detectFormat(sampleText);

  self.postMessage({ type: 'sniff', format, confidence });

  // Step 2: Process in 50MB chunks
  let chunkIndex = 0;
  let remainder = '';
  const startTime = Date.now();

  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
    const chunkText = await chunkBlob.text();
    const text = remainder + chunkText;
    const lines = text.split('\n');

    // Keep last partial line for next iteration
    remainder = lines.pop() ?? '';

    for (const line of lines) {
      const raw = line.trimEnd();
      if (!raw) continue;
      totalLines++;

      const entry = parseLine(raw, lineId++, format);
      if (entry.timestamp === null && entry.ip === null && entry.message === null) {
        errorLines++;
        continue;
      }
      allEntries.push(entry);
    }

    processedBytes = Math.min(offset + CHUNK_SIZE, totalBytes);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processedBytes / elapsed;
    const eta = rate > 0 ? Math.round((totalBytes - processedBytes) / rate) : 0;
    const percent = Math.round((processedBytes / totalBytes) * 100);

    self.postMessage({
      type: 'progress',
      percent,
      processedBytes,
      totalBytes,
      linesProcessed: totalLines,
      eta,
    });

    // Emit partial aggregation periodically for progressive dashboard
    chunkIndex++;
    if (chunkIndex % PARTIAL_EMIT_INTERVAL === 0) {
      const partial = buildAggregation([...allEntries], format, confidence, totalLines, errorLines);
      self.postMessage({ type: 'partial', aggregation: partial });
    }

    // Yield to allow GC between chunks
    await new Promise(r => setTimeout(r, 0));
  }

  // Process final remainder
  if (remainder.trim()) {
    const raw = remainder.trimEnd();
    totalLines++;
    const entry = parseLine(raw, lineId++, format);
    allEntries.push(entry);
  }

  const final = buildAggregation(allEntries, format, confidence, totalLines, errorLines);
  self.postMessage({ type: 'done', aggregation: final });
}

// ─── Message handler ─────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'start') {
    try {
      await processFile(e.data.file);
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
