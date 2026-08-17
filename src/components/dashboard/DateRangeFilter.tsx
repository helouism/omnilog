import type { Dispatch } from 'react';
import type { DateFilter, DateAction } from '../../core/dateFilter';

interface DateRangeFilterProps {
  df: DateFilter;
  dispatch: Dispatch<DateAction>;
  /** Full timestamp span of the loaded data, as `datetime-local` values. */
  dataDateRange: { min: string; max: string };
  filteredTotal: number;
  overallTotal: number | undefined;
}

/** Sticky date-range toolbar above the dashboard. State is lifted so the page can re-aggregate. */
export function DateRangeFilter({ df, dispatch, dataDateRange, filteredTotal, overallTotal }: DateRangeFilterProps) {
  const isFiltered = !!(df.appliedFrom || df.appliedTo);
  const isDirty = df.dateFrom !== df.appliedFrom || df.dateTo !== df.appliedTo;
  const applyFilter = () => dispatch({ type: 'apply' });

  return (
    <div className="ol-toolbar">
      <span className="ol-label mb-0">Date range</span>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-from" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>From</label>
        <input
          id="date-from"
          type="datetime-local"
          className="ol-input"
          style={{ width: 190 }}
          value={df.dateFrom}
          min={dataDateRange.min}
          max={df.dateTo || dataDateRange.max}
          onChange={e => dispatch({ type: 'setFrom', v: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
      </div>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-to" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>To</label>
        <input
          id="date-to"
          type="datetime-local"
          className="ol-input"
          style={{ width: 190 }}
          value={df.dateTo}
          min={df.dateFrom || dataDateRange.min}
          max={dataDateRange.max}
          onChange={e => dispatch({ type: 'setTo', v: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
      </div>

      <button
        type="button"
        className={`ol-btn ol-btn--sm ${isDirty ? 'ol-btn--primary' : ''}`}
        onClick={applyFilter}
      >
        Apply
      </button>

      {isFiltered && (
        <button type="button" className="ol-btn ol-btn--sm ol-btn--ghost" onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      )}

      <span className="ms-auto" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
        {isFiltered ? (
          <>
            <span style={{ color: 'var(--ol-text)', fontWeight: 600 }}>{filteredTotal.toLocaleString()}</span>
            {' of '}{overallTotal?.toLocaleString()}{' entries'}
          </>
        ) : dataDateRange.min ? (
          <span className="font-mono">{dataDateRange.min} — {dataDateRange.max}</span>
        ) : null}
      </span>
    </div>
  );
}
