export type LogFormat = 'nginx' | 'apache' | 'ufw' | 'syslog' | 'generic' | 'unknown';

export type SeverityLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN';

export interface LogEntry {
  id: number;
  raw: string;
  timestamp: Date | null;
  severity: SeverityLevel;
  ip: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  bytes: number | null;
  referer: string | null;
  userAgent: string | null;
  host: string | null;
  process: string | null;
  pid: number | null;
  message: string | null;
  // UFW-specific
  action: string | null;
  proto: string | null;
  spt: number | null;
  dpt: number | null;
}

export interface ParsedLog {
  entries: LogEntry[];
  format: LogFormat;
  confidence: number;
  totalLines: number;
  parsedLines: number;
  errorLines: number;
}

export interface AggregationResult {
  format: LogFormat;
  confidence: number;
  totalLines: number;
  parsedLines: number;
  errorLines: number;
  // Time series: minute-bucketed counts
  timeSeries: TimeSeriesBucket[];
  // Top IPs
  topIPs: IPCount[];
  // HTTP status distribution
  statusDistribution: StatusCount[];
  // Severity distribution
  severityDistribution: SeverityCount[];
  // All parsed entries (for virtual table)
  entries: LogEntry[];
}

export interface TimeSeriesBucket {
  timestamp: string; // ISO minute bucket e.g. "2024-01-01T10:05"
  requests: number;
  errors: number;
}

export interface IPCount {
  ip: string;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface SeverityCount {
  severity: SeverityLevel;
  count: number;
}

export type WorkerStatus = 'idle' | 'sniffing' | 'parsing' | 'done' | 'error';

export interface WorkerProgressEvent {
  type: 'progress';
  percent: number;
  processedBytes: number;
  totalBytes: number;
  linesProcessed: number;
  eta: number; // seconds remaining
}

export interface WorkerPartialEvent {
  type: 'partial';
  aggregation: AggregationResult;
}

export interface WorkerDoneEvent {
  type: 'done';
  aggregation: AggregationResult;
}

export interface WorkerErrorEvent {
  type: 'error';
  message: string;
}

export interface WorkerSniffEvent {
  type: 'sniff';
  format: LogFormat;
  confidence: number;
}

export type WorkerEvent =
  | WorkerProgressEvent
  | WorkerPartialEvent
  | WorkerDoneEvent
  | WorkerErrorEvent
  | WorkerSniffEvent;

export interface WorkerMessage {
  type: 'start';
  file: File;
}

export interface FilterState {
  query: string;
  isRegex: boolean;
  severities: SeverityLevel[];
  statusRange: [number, number] | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  ipCidr: string;
}

export interface IDBSession {
  id: string;
  fileName: string;
  fileSize: number;
  format: LogFormat;
  createdAt: Date;
  aggregation: AggregationResult;
}
