import { useState, useMemo, useReducer, lazy, Suspense, useEffect } from 'react';
import { ProgressBar } from '../dashboard/ProgressBar';
import { StatCards } from '../dashboard/StatCards';
import { DateRangeFilter } from '../dashboard/DateRangeFilter';
import { LandingView } from '../landing/LandingView';
import { VirtualLogTable } from '../table/VirtualLogTable';
import { dateReducer, INIT_DATE } from '../../core/dateFilter';
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

export function MainPage({ state, processFile, reset }: Props) {
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const [df, dispatch] = useReducer(dateReducer, INIT_DATE);

  useEffect(() => {
    document.title = 'OmniLog Analytics Engine — Browser-Based Log Analysis';
  }, []);

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

  return (
    <div className="flex-grow-1 d-flex flex-column overflow-hidden">
      {(state.status === 'parsing' || state.status === 'sniffing') && (
        <ProgressBar state={state} />
      )}

      {isIdle ? (
        <LandingView onFile={processFile} />
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
                <DateRangeFilter
                  df={df}
                  dispatch={dispatch}
                  dataDateRange={dataDateRange}
                  filteredTotal={filteredAgg.totalLines}
                  overallTotal={state.aggregation?.totalLines}
                />

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
