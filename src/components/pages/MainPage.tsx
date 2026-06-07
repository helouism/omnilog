import { useState, useMemo, useReducer, lazy, Suspense, useEffect } from 'react';
import { Dropzone } from '../uploader/Dropzone';
import { ProgressBar } from '../dashboard/ProgressBar';
import { StatCards } from '../dashboard/StatCards';
import { VirtualLogTable } from '../table/VirtualLogTable';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';
import type { AggregationResult, LogEntry, SeverityLevel } from '../../types/log.types';

const LazyChartsGrid = lazy(() => import('../dashboard/Charts'));

type ActiveTab = 'dashboard' | 'table';

function reAggregate(entries: LogEntry[], base: AggregationResult): AggregationResult {
  const tsMap = new Map<string, { requests: number; errors: number }>();
  const ipMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const sevMap = new Map<string, number>();

  for (const e of entries) {
    if (e.timestamp) {
      const key = e.timestamp.toISOString().slice(0, 16);
      const b = tsMap.get(key) ?? { requests: 0, errors: 0 };
      b.requests++;
      if (e.severity === 'ERROR' || e.severity === 'FATAL' || (e.status != null && e.status >= 400)) {
        b.errors++;
      }
      tsMap.set(key, b);
    }
    if (e.ip) ipMap.set(e.ip, (ipMap.get(e.ip) ?? 0) + 1);
    if (e.status != null) {
      const k = `${Math.floor(e.status / 100)}xx`;
      statusMap.set(k, (statusMap.get(k) ?? 0) + 1);
    }
    sevMap.set(e.severity, (sevMap.get(e.severity) ?? 0) + 1);
  }

  const timeSeries = [...tsMap.entries()]
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([timestamp, v]) => ({ timestamp, ...v }));

  const topIPs = [...ipMap.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const statusDistribution = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .toSorted((a, b) => a.status.localeCompare(b.status));

  const severityDistribution = [...sevMap.entries()]
    .map(([severity, count]) => ({ severity: severity as SeverityLevel, count }));

  return {
    ...base,
    totalLines: entries.length,
    parsedLines: entries.length,
    errorLines: entries.filter(e => e.severity === 'ERROR' || e.severity === 'FATAL').length,
    timeSeries,
    topIPs,
    statusDistribution,
    severityDistribution,
    entries,
  };
}

interface Props {
  state: AnalyticsState;
  processFile: (file: File) => void;
  reset: () => void;
}

type DateFilter = { dateFrom: string; dateTo: string; appliedFrom: string; appliedTo: string };
type DateAction =
  | { type: 'setFrom'; v: string }
  | { type: 'setTo'; v: string }
  | { type: 'apply' }
  | { type: 'clear' };
const INIT_DATE: DateFilter = { dateFrom: '', dateTo: '', appliedFrom: '', appliedTo: '' };
function dateReducer(s: DateFilter, a: DateAction): DateFilter {
  switch (a.type) {
    case 'setFrom': return { ...s, dateFrom: a.v };
    case 'setTo': return { ...s, dateTo: a.v };
    case 'apply': return { ...s, appliedFrom: s.dateFrom, appliedTo: s.dateTo };
    case 'clear': return INIT_DATE;
  }
}

export function MainPage({ state, processFile, reset }: Props) {
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const [df, dispatch] = useReducer(dateReducer, INIT_DATE);

  useEffect(() => {
    document.title = 'OmniLog Analytics Engine — Browser-Based Log Analysis';
  }, []);

  function applyFilter() { dispatch({ type: 'apply' }); }
  function clearFilter() { dispatch({ type: 'clear' }); }

  const dataDateRange = useMemo(() => {
    const ts = state.aggregation?.timeSeries;
    if (!ts || ts.length === 0) return { min: '', max: '' };
    return {
      min: ts[0].timestamp.slice(0, 16),
      max: ts[ts.length - 1].timestamp.slice(0, 16),
    };
  }, [state.aggregation]);

  const filteredAgg = useMemo<AggregationResult | null>(() => {
    if (!state.aggregation) return null;
    if (!df.appliedFrom && !df.appliedTo) return state.aggregation;

    const from = df.appliedFrom ? new Date(df.appliedFrom) : null;
    const to = df.appliedTo ? new Date(df.appliedTo) : null;

    const filtered = state.aggregation.entries.filter(e => {
      if (!e.timestamp) return false;
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    });

    return reAggregate(filtered, state.aggregation);
  }, [state.aggregation, df.appliedFrom, df.appliedTo]);

  const hasData = state.aggregation != null;
  const isIdle = state.status === 'idle';
  const isFiltered = !!(df.appliedFrom || df.appliedTo);
  const isDirty = df.dateFrom !== df.appliedFrom || df.dateTo !== df.appliedTo;

  return (
    <div className="flex-grow-1 d-flex flex-column overflow-hidden">
      {(state.status === 'parsing' || state.status === 'sniffing') && (
        <ProgressBar state={state} />
      )}

      {isIdle ? (
        <div className="flex-grow-1 overflow-auto">
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>

            {/* Hero */}
            <div className="text-center mb-5">
              <h1 className="fw-bold mb-3" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', lineHeight: 1.25 }}>
                Analyze Your Server Logs<br />Privately, In Your Browser
              </h1>
              <p className="text-secondary mx-auto mt-3" style={{ maxWidth: 560, lineHeight: 1.75, fontSize: '1rem' }}>
                Drop any log file and get instant charts, full-text search, and CSV export.
                No uploads, no servers, no accounts. Everything processes locally in your browser tab.
              </p>
            </div>

            {/* Dropzone */}
            <div style={{ height: 440, maxWidth: 620, margin: '0 auto 3.5rem' }}>
              <Dropzone onFile={processFile} />
            </div>

            {/* Feature grid */}
            <div className="row g-3 mb-5">
              {[
                {
                  icon: 'bi-shield-lock-fill',
                  color: 'text-success',
                  title: 'Zero Egress',
                  body: 'Log files are read locally via the browser File API and never sent anywhere. The Content Security Policy enforced by the server blocks all outbound connections involving your data.',
                },
                {
                  icon: 'bi-cpu-fill',
                  color: 'text-primary',
                  title: '100 GB+ Files',
                  body: 'Files are read in 50 MB streaming chunks via a background Web Worker, keeping the UI at 60 FPS regardless of file size. Only aggregated data crosses to the main thread — raw log strings are discarded after each chunk.',
                },
                {
                  icon: 'bi-braces-asterisk',
                  color: 'text-warning',
                  title: 'Auto-Detect Format',
                  body: 'Confidence scoring on the first 1 MB of your file automatically identifies NGINX combined log, Apache access/error log, UFW firewall log, and RFC 3164/5424 syslog. Falls back to a generic heuristic parser for anything else.',
                },
                {
                  icon: 'bi-table',
                  color: 'text-info',
                  title: 'Search and Filter',
                  body: 'Virtual scrolling table handles millions of rows without slowdown. Filter by severity, date range, IP CIDR, or full regex. Sort any column. Export the current filtered view to CSV.',
                },
              ].map(f => (
                <div className="col-12 col-sm-6 col-lg-3" key={f.title}>
                  <div className="h-100 p-3 rounded border border-secondary" style={{ background: '#161b22' }}>
                    <i className={`bi ${f.icon} ${f.color} d-block mb-2`} style={{ fontSize: '1.3rem' }} />
                    <h6 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>{f.title}</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{f.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Supported formats */}
            <div className="mb-5">
              <h2 className="fw-semibold mb-3" style={{ fontSize: '1.1rem' }}>Supported Log Formats</h2>
              <div className="table-responsive">
                <table className="table table-dark table-sm border-secondary mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr className="text-muted">
                      <th>Format</th>
                      <th>Detection</th>
                      <th>Extracts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['NGINX', 'Combined Log Format signature', 'IP, method, path, status, bytes, referer, user agent'],
                      ['Apache', 'Common Log + ErrorLog prefix', 'IP, method, path, status, bytes, error level, message'],
                      ['UFW', '[UFW BLOCK/ALLOW] prefix', 'SRC, DST, protocol, destination port, TCP flags'],
                      ['Syslog', 'RFC 3164/5424 PRI header', 'Facility, severity, hostname, process, message'],
                      ['Generic', 'Heuristic fallback', 'Timestamp, severity level, IP addresses, free-text message'],
                    ].map(([fmt, detect, extracts]) => (
                      <tr key={fmt}>
                        <td className="text-light fw-semibold">{fmt}</td>
                        <td className="text-muted">{detect}</td>
                        <td className="text-muted">{extracts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* How it works */}
            <div>
              <h2 className="fw-semibold mb-4" style={{ fontSize: '1.1rem' }}>How It Works</h2>
              <div className="row g-3">
                {[
                  {
                    step: '1',
                    title: 'Drop Your File',
                    body: 'Drag a log file onto the drop zone, or click to browse. Any format accepted, any size. Files never leave your computer.',
                  },
                  {
                    step: '2',
                    title: 'Format Detection',
                    body: 'OmniLog reads the first 1 MB and scores it against each parser. The highest-confidence format wins. The detected format and confidence score appear in the top bar.',
                  },
                  {
                    step: '3',
                    title: 'Stream and Explore',
                    body: 'The file is processed in 50 MB chunks in a background thread. Charts and the log table update progressively as each chunk completes. Search and filter as you go.',
                  },
                ].map(s => (
                  <div className="col-12 col-md-4" key={s.step}>
                    <div className="p-3 rounded border border-secondary h-100" style={{ background: '#161b22' }}>
                      <div className="fw-bold text-primary mb-2" style={{ fontSize: '1.1rem' }}>{s.step}</div>
                      <h6 className="fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>{s.title}</h6>
                      <p className="text-muted mb-0" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <>
          {hasData && (
            <div className="border-bottom border-secondary px-3">
              <ul className="nav nav-tabs border-0">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setTab('dashboard')}
                  >
                    <i className="bi bi-bar-chart-line me-2" />Dashboard
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'table' ? 'active' : ''}`}
                    onClick={() => setTab('table')}
                  >
                    <i className="bi bi-table me-2" />Log Table
                    <span className="badge bg-secondary ms-2" style={{ fontSize: '0.75rem' }}>
                      {state.aggregation?.entries.length.toLocaleString()}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          )}

          <div className="flex-grow-1 overflow-hidden">
            {tab === 'dashboard' && hasData && filteredAgg ? (
              <div className="h-100 overflow-auto p-3">
                <div className="card border-secondary mb-3" style={{ background: '#161b22' }}>
                  <div className="card-body p-2 d-flex align-items-center gap-3 flex-wrap">
                    <span className="text-muted small fw-semibold">
                      <i className="bi bi-funnel me-1" />Filter by date
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <label htmlFor="date-from" className="text-muted mb-0" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>From</label>
                      <input
                        id="date-from"
                        type="datetime-local"
                        className="form-control form-control-sm border-secondary"
                        style={{ fontSize: '0.75rem', width: 190, background: '#0d1117', color: '#e6edf3', colorScheme: 'dark' }}
                        value={df.dateFrom}
                        min={dataDateRange.min}
                        max={df.dateTo || dataDateRange.max}
                        onChange={e => dispatch({ type: 'setFrom', v: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && applyFilter()}
                      />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <label htmlFor="date-to" className="text-muted mb-0" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>To</label>
                      <input
                        id="date-to"
                        type="datetime-local"
                        className="form-control form-control-sm border-secondary"
                        style={{ fontSize: '0.75rem', width: 190, background: '#0d1117', color: '#e6edf3', colorScheme: 'dark' }}
                        value={df.dateTo}
                        min={df.dateFrom || dataDateRange.min}
                        max={dataDateRange.max}
                        onChange={e => dispatch({ type: 'setTo', v: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && applyFilter()}
                      />
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm px-2 py-0 ${isDirty ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.75rem' }}
                      onClick={applyFilter}
                    >
                      <i className="bi bi-check me-1" />Apply
                    </button>
                    {isFiltered && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-2 py-0"
                          style={{ fontSize: '0.75rem' }}
                          onClick={clearFilter}
                        >
                          <i className="bi bi-x me-1" />Clear
                        </button>
                        <span className="text-muted small">
                          <span className="text-light fw-semibold">{filteredAgg.totalLines.toLocaleString()}</span>
                          {' / '}
                          {state.aggregation?.totalLines.toLocaleString()} entries
                        </span>
                      </>
                    )}
                    {!isFiltered && dataDateRange.min && (
                      <span className="text-muted small">
                        Range: <span className="text-secondary">{dataDateRange.min}</span>
                        {' — '}
                        <span className="text-secondary">{dataDateRange.max}</span>
                      </span>
                    )}
                  </div>
                </div>

                <StatCards agg={filteredAgg} />
                <Suspense fallback={<div className="text-muted text-center py-4 small">Loading charts…</div>}>
                  <LazyChartsGrid agg={filteredAgg} />
                </Suspense>
              </div>
            ) : tab === 'dashboard' && !hasData ? (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                <div className="text-center">
                  <div className="spinner-border text-primary mb-3" />
                  <div>Processing…</div>
                </div>
              </div>
            ) : null}

            {tab === 'table' && hasData && filteredAgg ? (
              <VirtualLogTable entries={filteredAgg.entries} />
            ) : null}
          </div>

          {state.status === 'error' && (
            <div className="alert alert-danger m-3 d-flex gap-2">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{state.error}</span>
              <button type="button" className="btn-close btn-close-white ms-auto" aria-label="Dismiss error" onClick={reset} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
