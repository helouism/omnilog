import { describe, expect, it } from 'vitest';
import { isUsableTimestamp, reAggregate } from './aggregation';
import type { AggregationResult, LogEntry } from '../types/log.types';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    raw: '<34>1 - host app 123 ID - test message',
    timestamp: null,
    severity: 'INFO',
    ip: null,
    method: null,
    path: null,
    status: null,
    bytes: null,
    referer: null,
    userAgent: null,
    host: 'host',
    process: 'app',
    pid: 123,
    message: 'test message',
    action: null,
    proto: null,
    spt: null,
    dpt: null,
    ...overrides,
  };
}

const base: AggregationResult = {
  format: 'syslog',
  confidence: 1,
  totalLines: 0,
  parsedLines: 0,
  errorLines: 0,
  timeSeries: [],
  topIPs: [],
  statusDistribution: [],
  severityDistribution: [],
  entries: [],
};

describe('isUsableTimestamp', () => {
  it('accepts a real date', () => {
    expect(isUsableTimestamp(new Date())).toBe(true);
  });

  it('rejects null and an Invalid Date', () => {
    expect(isUsableTimestamp(null)).toBe(false);
    expect(isUsableTimestamp(new Date('-'))).toBe(false);
  });
});

describe('reAggregate', () => {
  it('does not throw on an Invalid Date and keeps the entry', () => {
    const bad = makeEntry({ id: 1, timestamp: new Date('-') });
    const good = makeEntry({ id: 2, timestamp: new Date('2026-11-22T10:15:00Z') });

    const result = reAggregate([bad, good], base);

    expect(result.timeSeries).toHaveLength(1);
    expect(result.timeSeries[0].timestamp).toBe('2026-11-22T10:15');
    expect(result.entries).toHaveLength(2);
  });

  it('skips bucketing when the timestamp is null', () => {
    const result = reAggregate([makeEntry({ id: 1, timestamp: null })], base);

    expect(result.timeSeries).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
  });
});
