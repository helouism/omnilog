import type { LogEntry } from '../types/log.types';

/** Keep error semantics identical across worker aggregation and filtered views. */
export function isErrorEntry(entry: LogEntry): boolean {
  return (
    entry.severity === 'ERROR' ||
    entry.severity === 'FATAL' ||
    (entry.status != null && entry.status >= 400)
  );
}
