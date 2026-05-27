import type { LogEntry, SeverityLevel } from '../../types/log.types';

// RFC 3164: <PRI>Mon DD HH:MM:SS hostname process[pid]: message
// RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
const RFC3164 =
  /^<(\d+)>(\w{3}\s+\d+\s+[\d:]+)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.*)/;
const RFC5424 =
  /^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(?:-|\[.*?\])\s*(.*)/;
// Without PRI (plain syslog)
const PLAIN_SYSLOG =
  /^(\w{3}\s+\d+\s+[\d:]+)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.*)/;

const FACILITY_NAMES = [
  'kern','user','mail','daemon','auth','syslog','lpr','news',
  'uucp','cron','authpriv','ftp','','','','','local0','local1',
  'local2','local3','local4','local5','local6','local7',
];

const SEVERITY_NAMES: SeverityLevel[] = [
  'FATAL','FATAL','FATAL','ERROR','WARN','INFO','INFO','DEBUG',
];

function decodePri(pri: number): { facility: string; severity: SeverityLevel } {
  const facility = FACILITY_NAMES[Math.floor(pri / 8)] ?? 'unknown';
  const severity = SEVERITY_NAMES[pri % 8] ?? 'UNKNOWN';
  return { facility, severity };
}

function parseSyslogDate(raw: string): Date | null {
  const d = new Date(`${raw} ${new Date().getFullYear()}`);
  return isNaN(d.getTime()) ? null : d;
}

export function parseSyslogLine(raw: string, id: number): LogEntry | null {
  let m = RFC5424.exec(raw);
  if (m) {
    const { severity } = decodePri(parseInt(m[1]));
    return {
      id, raw,
      timestamp: new Date(m[3]),
      severity,
      ip: null, method: null, path: null, status: null, bytes: null,
      referer: null, userAgent: null,
      host: m[4],
      process: m[5],
      pid: m[6] !== '-' ? parseInt(m[6]) : null,
      message: m[8],
      action: null, proto: null, spt: null, dpt: null,
    };
  }

  m = RFC3164.exec(raw);
  if (m) {
    const { severity } = decodePri(parseInt(m[1]));
    return {
      id, raw,
      timestamp: parseSyslogDate(m[2]),
      severity,
      ip: null, method: null, path: null, status: null, bytes: null,
      referer: null, userAgent: null,
      host: m[3],
      process: m[4],
      pid: m[5] ? parseInt(m[5]) : null,
      message: m[6],
      action: null, proto: null, spt: null, dpt: null,
    };
  }

  m = PLAIN_SYSLOG.exec(raw);
  if (m) {
    return {
      id, raw,
      timestamp: parseSyslogDate(m[1]),
      severity: 'INFO',
      ip: null, method: null, path: null, status: null, bytes: null,
      referer: null, userAgent: null,
      host: m[2],
      process: m[3],
      pid: m[4] ? parseInt(m[4]) : null,
      message: m[5],
      action: null, proto: null, spt: null, dpt: null,
    };
  }

  return null;
}

export function scoreSyslog(sample: string): number {
  const lines = sample.split('\n').filter(Boolean).slice(0, 200);
  if (!lines.length) return 0;
  const matched = lines.filter(l => RFC5424.test(l) || RFC3164.test(l) || PLAIN_SYSLOG.test(l)).length;
  return matched / lines.length;
}
