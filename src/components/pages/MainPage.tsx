import { useState, useMemo, useReducer, lazy, Suspense, useEffect } from 'react';
import { ProgressBar } from '../dashboard/ProgressBar';
import { StatCards } from '../dashboard/StatCards';
import { DateRangeFilter } from '../dashboard/DateRangeFilter';
import { LandingView } from '../landing/LandingView';
import { VirtualLogTable } from '../table/VirtualLogTable';
import { dateReducer, INIT_DATE } from '../../core/dateFilter';
import { BarChartLine, Table, ExclamationTriangle, XLg } from '../icons';
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
      {isIdle ? (
        <LandingView onFile={processFile} />
      ) : (
        // <main> starts here rather than at the root, and the idle branch above
        // carries its own: LandingView ends in a <footer>, and a <footer> nested
        // inside <main> is no longer exposed as contentinfo. Exactly one <main>
        // renders either way, since the two branches are mutually exclusive.
        <main className="flex-grow-1 d-flex flex-column overflow-hidden">
          {/* Inside <main>, not above it: this only ever renders while the
              status is parsing or sniffing, neither of which is idle, so the
              branch it would sit outside of is always the one being drawn.
              Left where it was it belonged to no landmark at all. */}
          {(state.status === 'parsing' || state.status === 'sniffing') && (
            <ProgressBar state={state} />
          )}

          {hasData && (
            <div className="px-4" style={{ background: 'var(--ol-bg)' }}>
              <div className="ol-tabs">
                <button
                  type="button"
                  className={`ol-tab ${tab === 'dashboard' ? 'is-active' : ''}`}
                  onClick={() => setTab('dashboard')}
                >
                  <BarChartLine size={14} />Dashboard
                </button>
                <button
                  type="button"
                  className={`ol-tab ${tab === 'table' ? 'is-active' : ''}`}
                  onClick={() => setTab('table')}
                >
                  <Table size={14} />Log table
                  <span className="ol-chip">{state.aggregation?.entries.length.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex-grow-1 overflow-hidden">
            {tab === 'dashboard' && hasData && filteredAgg ? (
              // No padding on the scroll container: .ol-toolbar below is opaque
              // and full-bleed by design. Inset it by a gutter and the content
              // scrolling underneath stays visible in the strip either side of
              // it. (Vertical sticking is unaffected either way — a scroll
              // container's sticky rect is its padding box, so `top: 0` pins to
              // the inner edge regardless.) The gutter lives on the content.
              <div className="h-100 overflow-auto">
                {/* The dashboard is dense and data-forward, so its title is for
                    assistive tech only — but it has to exist: without it the
                    chart <h2>s have no root and pressing H lands on nothing. */}
                <h1 className="visually-hidden">Log analysis dashboard</h1>

                <DateRangeFilter
                  df={df}
                  dispatch={dispatch}
                  dataDateRange={dataDateRange}
                  filteredTotal={filteredAgg.totalLines}
                  overallTotal={state.aggregation?.totalLines}
                />

                <div className="p-4">
                  <StatCards agg={filteredAgg} />
                  <Suspense fallback={<div className="text-center py-4" style={{ color: 'var(--ol-text-faint)', fontSize: 'var(--ol-fs-sm)' }}>Loading charts…</div>}>
                    <LazyChartsGrid agg={filteredAgg} />
                  </Suspense>
                </div>
              </div>
            ) : tab === 'dashboard' && !hasData ? (
              <div
                className="d-flex align-items-center justify-content-center h-100"
                style={{ color: 'var(--ol-text-faint)', fontSize: 'var(--ol-fs-sm)' }}
              >
                Processing…
              </div>
            ) : null}

            {tab === 'table' && hasData && filteredAgg ? (
              <VirtualLogTable entries={filteredAgg.entries} />
            ) : null}
          </div>

          {state.status === 'error' && (
            <div
              className="ol-panel ol-panel-pad d-flex align-items-center gap-2 m-4"
              role="alert"
              style={{ borderColor: 'var(--ol-sev-error)' }}
            >
              {/* Kept as an icon, unlike the decorative ones this task deleted:
                  it is the only thing that types the panel as a failure before
                  the message is read. */}
              <ExclamationTriangle size={14} className="flex-shrink-0" />
              <span style={{ color: 'var(--ol-sev-error)', fontSize: 'var(--ol-fs-sm)' }}>{state.error}</span>
              {/* --icon, not --sm: an icon-only flex button has no line-box
                  strut, so it collapses to the SVG height and misses SC 2.5.8's
                  24x24. --icon sets that floor explicitly. */}
              <button
                type="button"
                className="ol-btn ol-btn--icon ms-auto"
                aria-label="Dismiss error"
                onClick={reset}
              >
                <XLg size={12} />
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
