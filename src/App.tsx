import { useState, useMemo, useEffect, useRef } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Dropzone } from './components/uploader/Dropzone';
import { ProgressBar } from './components/dashboard/ProgressBar';
import { StatCards } from './components/dashboard/StatCards';
import { TimeSeriesChart, TopIPsChart, StatusDistributionChart, SeverityChart } from './components/dashboard/Charts';
import { VirtualLogTable } from './components/table/VirtualLogTable';
import { useLogAnalytics } from './hooks/useLogAnalytics';
import type { AggregationResult, LogEntry, SeverityLevel } from './types/log.types';

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
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([timestamp, v]) => ({ timestamp, ...v }));

  const topIPs = [...ipMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const statusDistribution = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status));

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

export default function App() {
  const { state, processFile, reset } = useLogAnalytics();
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const prevFileRef = useRef<string | null>(null);

  function applyFilter() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  }

  function clearFilter() {
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
  }

  useEffect(() => {
    if (state.fileName !== prevFileRef.current) {
      prevFileRef.current = state.fileName;
      setDateFrom('');
      setDateTo('');
      setAppliedFrom('');
      setAppliedTo('');
    }
  }, [state.fileName]);

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
    if (!appliedFrom && !appliedTo) return state.aggregation;

    const from = appliedFrom ? new Date(appliedFrom) : null;
    const to = appliedTo ? new Date(appliedTo) : null;

    const filtered = state.aggregation.entries.filter(e => {
      if (!e.timestamp) return false;
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    });

    return reAggregate(filtered, state.aggregation);
  }, [state.aggregation, appliedFrom, appliedTo]);

  const hasData = state.aggregation != null;
  const isIdle = state.status === 'idle';
  const isFiltered = !!(appliedFrom || appliedTo);
  const isDirty = dateFrom !== appliedFrom || dateTo !== appliedTo;

  return (
    <div className="d-flex flex-column h-100 bg-dark text-white" style={{ background: '#0d1117' }}>
      <Navbar state={state} onReset={reset} />

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
                    className={`nav-link ${tab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setTab('dashboard')}
                  >
                    <i className="bi bi-bar-chart-line me-2" />Dashboard
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'table' ? 'active' : ''}`}
                    onClick={() => setTab('table')}
                  >
                    <i className="bi bi-table me-2" />Log Table
                    <span className="badge bg-secondary ms-2" style={{ fontSize: '0.65rem' }}>
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
                      <label className="text-muted mb-0" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>From</label>
                      <input
                        type="datetime-local"
                        className="form-control form-control-sm border-secondary"
                        style={{ fontSize: '0.75rem', width: 190, background: '#0d1117', color: '#e6edf3', colorScheme: 'dark' }}
                        value={dateFrom}
                        min={dataDateRange.min}
                        max={dateTo || dataDateRange.max}
                        onChange={e => setDateFrom(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyFilter()}
                      />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <label className="text-muted mb-0" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>To</label>
                      <input
                        type="datetime-local"
                        className="form-control form-control-sm border-secondary"
                        style={{ fontSize: '0.75rem', width: 190, background: '#0d1117', color: '#e6edf3', colorScheme: 'dark' }}
                        value={dateTo}
                        min={dateFrom || dataDateRange.min}
                        max={dataDateRange.max}
                        onChange={e => setDateTo(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyFilter()}
                      />
                    </div>
                    <button
                      className={`btn btn-sm px-2 py-0 ${isDirty ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.75rem' }}
                      onClick={applyFilter}
                    >
                      <i className="bi bi-check me-1" />Apply
                    </button>
                    {isFiltered && (
                      <>
                        <button
                          className="btn btn-sm btn-outline-secondary px-2 py-0"
                          style={{ fontSize: '0.75rem' }}
                          onClick={clearFilter}
                        >
                          <i className="bi bi-x me-1" />Clear
                        </button>
                        <span className="text-muted small">
                          <span className="text-light fw-semibold">{filteredAgg.totalLines.toLocaleString()}</span>
                          {' / '}
                          {state.aggregation.totalLines.toLocaleString()} entries
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
                <div className="row g-3">
                  <div className="col-12 col-lg-8">
                    <TimeSeriesChart agg={filteredAgg} />
                  </div>
                  <div className="col-12 col-lg-4">
                    <StatusDistributionChart agg={filteredAgg} />
                  </div>
                  <div className="col-12 col-lg-6">
                    <TopIPsChart agg={filteredAgg} />
                  </div>
                  <div className="col-12 col-lg-6">
                    <SeverityChart agg={filteredAgg} />
                  </div>
                </div>
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
              <button className="btn-close btn-close-white ms-auto" onClick={reset} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
