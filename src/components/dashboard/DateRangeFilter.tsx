import type { Dispatch } from 'react';
import type { DateFilter, DateAction } from '../../core/dateFilter';

const INPUT_STYLE = {
  fontSize: '0.75rem',
  width: 190,
  background: '#0d1117',
  color: '#e6edf3',
  colorScheme: 'dark',
} as const;

interface DateRangeFilterProps {
  df: DateFilter;
  dispatch: Dispatch<DateAction>;
  /** Full timestamp span of the loaded data, as `datetime-local` values. */
  dataDateRange: { min: string; max: string };
  filteredTotal: number;
  overallTotal: number | undefined;
}

/** Date-range toolbar above the dashboard. State is lifted so the page can re-aggregate. */
export function DateRangeFilter({ df, dispatch, dataDateRange, filteredTotal, overallTotal }: DateRangeFilterProps) {
  const isFiltered = !!(df.appliedFrom || df.appliedTo);
  const isDirty = df.dateFrom !== df.appliedFrom || df.dateTo !== df.appliedTo;
  const applyFilter = () => dispatch({ type: 'apply' });

  return (
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
            style={INPUT_STYLE}
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
            style={INPUT_STYLE}
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
              onClick={() => dispatch({ type: 'clear' })}
            >
              <i className="bi bi-x me-1" />Clear
            </button>
            <span className="text-muted small">
              <span className="text-light fw-semibold">{filteredTotal.toLocaleString()}</span>
              {' / '}
              {overallTotal?.toLocaleString()} entries
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
  );
}
