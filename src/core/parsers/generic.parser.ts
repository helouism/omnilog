import type { LogEntry, SeverityLevel } from '../../types/log.types';

// ISO 8601 and common variants
const TS_ISO = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
// Syslog-style
const TS_SYSLOG = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+\s+\d{2}:\d{2}:\d{2}\b/;
// Apache-style [DD/Mon/YYYY:HH:MM:SS ±HHMM]
const TS_APACHE = /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s[+-]\d{4}/;
// Unix epoch (10 or 13 digits)
const TS_EPOCH = /\b(1[3-9]\d{8}|1[0-9]\d{12})\b/;

const SEVERITY_KEYWORDS: [RegExp, SeverityLevel][] = [
  [/\b(FATAL|CRITICAL|EMERG|EMERGENCY|PANIC)\b/i, 'FATAL'],
  [/\b(ERROR|ERR|SEVERE|50[0-9])\b/i, 'ERROR'],
  [/\b(WARN(?:ING)?|40[0-9])\b/i, 'WARN'],
  [/\b(INFO|NOTICE|20[0-9]|30[0-9])\b/i, 'INFO'],
  [/\b(DEBUG|TRACE|VERBOSE)\b/i, 'DEBUG'],
];

const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/;
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;

function extractTimestamp(line: string): Date | null {
  let m: RegExpExecArray | null;

  m = TS_ISO.exec(line);
  if (m) { const d = new Date(m[0]); if (!isNaN(d.getTime())) return d; }

  m = TS_APACHE.exec(line);
  if (m) {
    const clean = m[0].replace('/', ' ').replace('/', ' ').replace(':', ' ');
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d;
  }

  m = TS_SYSLOG.exec(line);
  if (m) {
    const d = new Date(`${m[0]} ${new Date().getFullYear()}`);
    if (!isNaN(d.getTime())) return d;
  }

  m = TS_EPOCH.exec(line);
  if (m) {
    const n = parseInt(m[1]);
    return new Date(n < 1e12 ? n * 1000 : n);
  }

  return null;
}

function extractSeverity(line: string): SeverityLevel {
  for (const [re, level] of SEVERITY_KEYWORDS) {
    if (re.test(line)) return level;
  }
  return 'UNKNOWN';
}

export function parseGenericLine(raw: string, id: number): LogEntry {
  const ipMatch = IP_REGEX.exec(raw);
  const emailMatch = EMAIL_REGEX.exec(raw);

  return {
    id, raw,
    timestamp: extractTimestamp(raw),
    severity: extractSeverity(raw),
    ip: ipMatch ? ipMatch[0] : null,
    method: null,
    path: null,
    status: null,
    bytes: null,
    referer: emailMatch ? emailMatch[0] : null,
    userAgent: null,
    host: null,
    process: null,
    pid: null,
    message: raw.slice(0, 512),
    action: null, proto: null, spt: null, dpt: null,
  };
}

export function scoreGeneric(_sample: string): number {
  return 0; // Always fallback — never wins confidence scoring
}
