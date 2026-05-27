import type { LogEntry, SeverityLevel } from '../../types/log.types';

// Nginx Combined Log Format:
// 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://ref" "Mozilla/5.0"
const NGINX_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d{3})\s+(\d+|-)\s*(?:"([^"]*)")?\s*(?:"([^"]*)")?/;

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseNginxDate(raw: string): Date | null {
  // "10/Oct/2000:13:55:36 -0700"
  const m = raw.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([-+]\d{4})/);
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, tz] = m;
  const month = MONTH_MAP[mon];
  if (month === undefined) return null;
  const tzOffset = parseInt(tz.slice(0, 3)) * 60 + parseInt(tz.slice(0, 1) + tz.slice(3));
  const utc = Date.UTC(+year, month, +day, +hh, +mm, +ss) - tzOffset * 60000;
  return new Date(utc);
}

function statusToSeverity(status: number): SeverityLevel {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARN';
  return 'INFO';
}

export function parseNginxLine(raw: string, id: number): LogEntry | null {
  const m = NGINX_REGEX.exec(raw);
  if (!m) return null;
  const status = parseInt(m[5]);
  return {
    id,
    raw,
    timestamp: parseNginxDate(m[2]),
    severity: statusToSeverity(status),
    ip: m[1],
    method: m[3],
    path: m[4],
    status,
    bytes: m[6] === '-' ? null : parseInt(m[6]),
    referer: m[7] || null,
    userAgent: m[8] || null,
    host: null,
    process: null,
    pid: null,
    message: null,
    action: null,
    proto: null,
    spt: null,
    dpt: null,
  };
}

export function scoreNginx(sample: string): number {
  const lines = sample.split('\n').filter(Boolean).slice(0, 200);
  if (!lines.length) return 0;
  const matched = lines.filter(l => NGINX_REGEX.test(l)).length;
  return matched / lines.length;
}
