import type { LogEntry } from '../../types/log.types';

// UFW: May 26 12:34:56 hostname kernel: [UFW BLOCK] IN=eth0 OUT= MAC=... SRC=1.2.3.4 DST=5.6.7.8 PROTO=TCP SPT=1234 DPT=80
const UFW_PREFIX = /\[UFW\s+(BLOCK|ALLOW|LIMIT|AUDIT)\]/;
const UFW_SYSLOG_DATE = /^(\w{3}\s+\d+\s+[\d:]+)\s+(\S+)\s+kernel:/;

function extractField(line: string, key: string): string | null {
  const m = line.match(new RegExp(`\\b${key}=(\\S+)`));
  return m ? m[1] || null : null;
}

function parseSyslogDate(raw: string): Date | null {
  const d = new Date(`${raw} ${new Date().getFullYear()}`);
  return isNaN(d.getTime()) ? null : d;
}

export function parseUfwLine(raw: string, id: number): LogEntry | null {
  const actionMatch = UFW_PREFIX.exec(raw);
  if (!actionMatch) return null;

  const dateMatch = UFW_SYSLOG_DATE.exec(raw);
  const timestamp = dateMatch ? parseSyslogDate(dateMatch[1]) : null;
  const host = dateMatch ? dateMatch[2] : null;

  const spt = extractField(raw, 'SPT');
  const dpt = extractField(raw, 'DPT');
  const protoRaw = extractField(raw, 'PROTO');

  return {
    id, raw,
    timestamp,
    severity: actionMatch[1] === 'BLOCK' ? 'WARN' : 'INFO',
    ip: extractField(raw, 'SRC'),
    method: null,
    path: null,
    status: null,
    bytes: null,
    referer: null,
    userAgent: null,
    host,
    process: 'kernel',
    pid: null,
    message: raw,
    action: actionMatch[1],
    proto: protoRaw,
    spt: spt ? parseInt(spt) : null,
    dpt: dpt ? parseInt(dpt) : null,
  };
}

export function scoreUfw(sample: string): number {
  const lines = sample.split('\n').filter(Boolean).slice(0, 200);
  if (!lines.length) return 0;
  const matched = lines.filter(l => UFW_PREFIX.test(l)).length;
  return matched / lines.length;
}
