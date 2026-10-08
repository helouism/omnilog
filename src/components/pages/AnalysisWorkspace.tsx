import { useMemo, useReducer, lazy, Suspense } from 'react';
import { ProgressBar } from '../dashboard/ProgressBar';
import { StatCards } from '../dashboard/StatCards';
import { DateRangeFilter } from '../dashboard/DateRangeFilter';
import { VirtualLogTable } from '../table/VirtualLogTable';
import { dateReducer, INIT_DATE } from '../../core/dateFilter';
import { BarChartLine, Table, ExclamationTriangle, XLg } from '../icons';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';
import { reAggregate } from '../../core/aggregation';

const LazyChartsGrid = lazy(() => import('../dashboard/Charts'));

type ActiveTab = 'dashboard' | 'table';

interface AnalysisWorkspaceProps {
  state: AnalyticsState;
  reset: () => void;
}

function ErrorPanel({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="ol-panel ol-panel--error ol-panel-pad d-flex align-items-center gap-2 m-3" role="alert">
      <ExclamationTriangle size={14} className="flex-shrink-0" />
      <span style={{ color: 'var(--ol-sev-error)', fontSize: 'var(--ol-fs-sm)' }}>{message}</span>
      <button type="button" className="ol-btn ol-btn--icon ms-auto" aria-label="Dismiss error" onClick={onDismiss}>
        <XLg size={12} />
      </button>
    </div>
  );
}

function WorkspaceTabs({ tab, setTab, rowCount }: { tab: ActiveTab; setTab: (tab: ActiveTab) => void; rowCount: number }) {
  return (
    <div className="px-3" style={{ background: 'var(--ol-bg)' }}>
      <div className="ol-tabs">
        <button type="button" aria-pressed={tab === 'dashboard'} className={`ol-tab ${tab === 'dashboard' ? 'is-active' : ''}`} onClick={() => setTab('dashboard')}>
          <BarChartLine size={14} />Dashboard
        </button>
        <button type="button" aria-pressed={tab === 'table'} className={`ol-tab ${tab === 'table' ? 'is-active' : ''}`} onClick={() => setTab('table')}>
          <Table size={14} />Log table
          <span className="ol-chip">{rowCount.toLocaleString()}</span>
        </button>
      </div>
    </div>
  );
}

function DashboardPanel({ state }: Pick<AnalysisWorkspaceProps, 'state'>) {
  const [df, dispatch] = useReducer(dateReducer, INIT_DATE);
  const dataDateRange = useMemo(() => {
    const ts = state.aggregation?.timeSeries;
    if (!ts || ts.length === 0) return { min: '', max: '' };
    return { min: ts[0].timestamp.slice(0, 16), max: ts[ts.length - 1].timestamp.slice(0, 16) };
  }, [state.aggregation]);

  const aggregation = state.aggregation;
  const filteredAgg = useMemo(() => {
    if (!aggregation) return null;
    if (!df.appliedFrom && !df.appliedTo) return aggregation;
    const from = df.appliedFrom ? new Date(df.appliedFrom) : null;
    const to = df.appliedTo ? new Date(df.appliedTo) : null;
    const entries = aggregation.entries.filter(entry => {
      if (!entry.timestamp) return false;
      return (!from || entry.timestamp >= from) && (!to || entry.timestamp <= to);
    });
    return reAggregate(entries, aggregation);
  }, [aggregation, df.appliedFrom, df.appliedTo]);

  if (!filteredAgg) return <div className="d-flex align-items-center justify-content-center h-100" style={{ color: 'var(--ol-text-faint)', fontSize: 'var(--ol-fs-sm)' }}>Processing…</div>;

  return (
    <div className="h-100 overflow-auto">
      <h1 className="visually-hidden">Log analysis dashboard</h1>
      <DateRangeFilter df={df} dispatch={dispatch} dataDateRange={dataDateRange} filteredTotal={filteredAgg.totalLines} overallTotal={aggregation?.totalLines} />
      <div style={{ padding: 'var(--ol-sp-4)' }}>
        <StatCards agg={filteredAgg} />
        <Suspense fallback={<div className="text-center py-4" style={{ color: 'var(--ol-text-faint)', fontSize: 'var(--ol-fs-sm)' }}>Loading charts…</div>}>
          <LazyChartsGrid agg={filteredAgg} />
        </Suspense>
      </div>
    </div>
  );
}

export function AnalysisWorkspace({ state, reset }: AnalysisWorkspaceProps) {
  const [tab, setTab] = useReducer((_: ActiveTab, next: ActiveTab) => next, 'dashboard');
  const hasData = state.aggregation != null;
  const isProcessing = state.status === 'parsing' || state.status === 'sniffing';

  return (
    <main className="flex-grow-1 d-flex flex-column overflow-hidden">
      {isProcessing && <ProgressBar state={state} onCancel={reset} />}
      {hasData && <WorkspaceTabs tab={tab} setTab={setTab} rowCount={state.aggregation?.entries.length ?? 0} />}
      <div className="flex-grow-1 overflow-hidden">
        {tab === 'dashboard' && <DashboardPanel state={state} />}
        {tab === 'table' && state.aggregation && <VirtualLogTable entries={state.aggregation.entries} />}
      </div>
      <ErrorPanel message={state.status === 'error' ? state.error : null} onDismiss={reset} />
    </main>
  );
}
