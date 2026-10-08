import type { AggregationResult, LogEntry, SeverityLevel } from '../types/log.types';
import { isErrorEntry } from './entryMetrics';

/** Rebuild dashboard aggregates after a date-range filter is applied. */
export function reAggregate(entries: LogEntry[], base: AggregationResult): AggregationResult {
  const tsMap = new Map<string, { requests: number; errors: number }>();
  const ipMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const severityMap = new Map<SeverityLevel, number>();

  for (const entry of entries) {
    if (entry.timestamp) {
      const key = entry.timestamp.toISOString().slice(0, 16);
      const bucket = tsMap.get(key) ?? { requests: 0, errors: 0 };
      bucket.requests++;
      if (isErrorEntry(entry)) bucket.errors++;
      tsMap.set(key, bucket);
    }
    if (entry.ip) ipMap.set(entry.ip, (ipMap.get(entry.ip) ?? 0) + 1);
    if (entry.status != null) {
      const key = `${Math.floor(entry.status / 100)}xx`;
      statusMap.set(key, (statusMap.get(key) ?? 0) + 1);
    }
    severityMap.set(entry.severity, (severityMap.get(entry.severity) ?? 0) + 1);
  }

  return {
    ...base,
    totalLines: entries.length,
    parsedLines: entries.length,
    errorLines: entries.filter(isErrorEntry).length,
    timeSeries: [...tsMap.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([timestamp, value]) => ({ timestamp, ...value })),
    topIPs: [...ipMap.entries()].toSorted(([, a], [, b]) => b - a).slice(0, 10).map(([ip, count]) => ({ ip, count })),
    statusDistribution: [...statusMap.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([status, count]) => ({ status, count })),
    severityDistribution: [...severityMap.entries()].map(([severity, count]) => ({ severity, count })),
    entries,
  };
}
