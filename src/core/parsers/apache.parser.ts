import type { LogEntry, SeverityLevel } from '../../types/log.types';

// Apache Common Log Format + Combined
const APACHE_COMMON =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d{3})\s+(\d+|-)/;

// Apache ErrorLog: [day mon dd time year] [level] [pid N] message
const APACHE_ERROR =
  /^\[(\w{3}\s+\w{3}\s+\d+\s[\d:]+\s\d+)\]\s+\[(\w+)\]\s+(?:\[pid\s+(\d+)\]\s+)?(.+)/;

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseApacheDate(raw: string): Date | null {
  const m = raw.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([-+]\d{4})/);
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, tz] = m;
  const month = MONTH_MAP[mon];
  if (month === undefined) return null;
  const tzOffset = parseInt(tz.slice(0, 3)) * 60 + parseInt(tz.slice(0, 1) + tz.slice(3));
  const utc = Date.UTC(+year, month, +day, +hh, +mm, +ss) - tzOffset * 60000;
  return new Date(utc);
}

function levelToSeverity(level: string): SeverityLevel {
  const l = level.toLowerCase();
  if (l === 'emerg' || l === 'alert' || l === 'crit' || l === 'fatal') return 'FATAL';
  if (l === 'error') return 'ERROR';
  if (l === 'warn' || l === 'warning') return 'WARN';
  if (l === 'notice' || l === 'info') return 'INFO';
  if (l === 'debug') return 'DEBUG';
  return 'UNKNOWN';
}

function statusToSeverity(status: number): SeverityLevel {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARN';
  return 'INFO';
}

export function parseApacheLine(raw: string, id: number): LogEntry | null {
  let m = APACHE_COMMON.exec(raw);
  if (m) {
    const status = parseInt(m[7]);
    return {
      id, raw,
      timestamp: parseApacheDate(m[4]),
      severity: statusToSeverity(status),
      ip: m[1],
      method: m[5],
      path: m[6],
      status,
      bytes: m[8] === '-' ? null : parseInt(m[8]),
      referer: null,
      userAgent: null,
      host: null,
      process: null,
      pid: null,
      message: null,
      action: null, proto: null, spt: null, dpt: null,
    };
  }

  m = APACHE_ERROR.exec(raw);
  if (m) {
    return {
      id, raw,
      timestamp: new Date(m[1]),
      severity: levelToSeverity(m[2]),
      ip: null, method: null, path: null, status: null, bytes: null,
      referer: null, userAgent: null, host: null,
      process: 'apache',
      pid: m[3] ? parseInt(m[3]) : null,
      message: m[4],
      action: null, proto: null, spt: null, dpt: null,
    };
  }

  return null;
}

export function scoreApache(sample: string): number {
  const lines = sample.split('\n').filter(Boolean).slice(0, 200);
  if (!lines.length) return 0;
  const matched = lines.filter(l => APACHE_COMMON.test(l) || APACHE_ERROR.test(l)).length;
  return matched / lines.length;
}
