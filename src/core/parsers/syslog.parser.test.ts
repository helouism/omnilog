import { describe, expect, it } from 'vitest';
import { parseSyslogLine } from './syslog.parser';

describe('parseSyslogLine — RFC 5424', () => {
  it('parses a real timestamp', () => {
    const entry = parseSyslogLine('<34>1 2026-11-22T10:15:00.000Z host app 123 ID - test message', 1);

    expect(entry).not.toBeNull();
    expect(entry?.timestamp).toBeInstanceOf(Date);
    expect(Number.isNaN(entry?.timestamp?.getTime() ?? NaN)).toBe(false);
  });

  it('treats the NILVALUE timestamp as absent instead of an Invalid Date', () => {
    const entry = parseSyslogLine('<34>1 - host app 123 ID - test message', 1);

    expect(entry).not.toBeNull();
    expect(entry?.timestamp).toBeNull();
    expect(entry?.message).toBe('test message');
  });

  it('returns null for a malformed timestamp rather than an Invalid Date', () => {
    const entry = parseSyslogLine('<34>1 not-a-date host app 123 ID - test message', 1);

    expect(entry).not.toBeNull();
    expect(entry?.timestamp).toBeNull();
  });

  it('still parses RFC 3164 dates', () => {
    const entry = parseSyslogLine('<34>Oct  8 17:05:00 host app: hello', 1);

    expect(entry).not.toBeNull();
    expect(entry?.timestamp).toBeInstanceOf(Date);
  });
});
