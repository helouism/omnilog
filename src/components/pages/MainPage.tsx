import { useState, useMemo, useReducer, lazy, Suspense } from 'react';
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
        <div className="flex-grow-1 overflow-hidden">
          <Dropzone onFile={processFile} />
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
