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
      {/* The two fields read as bare "From"/"To" on their own, so each input is
          labelled by the group heading AND its own label: "Date range From".
          Done with aria-labelledby rather than a <fieldset> because .ol-toolbar
          lays its children out directly and a wrapper would break the flex row. */}
      <span className="ol-label" id="date-range-label">Date range</span>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-from" id="date-from-label" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>From</label>
        <input
          id="date-from"
          aria-labelledby="date-range-label date-from-label"
          type="datetime-local"
          className="ol-input"
          style={{ width: '100%', maxWidth: 190 }}
          value={df.dateFrom}
          min={dataDateRange.min}
          max={df.dateTo || dataDateRange.max}
          onChange={e => dispatch({ type: 'setFrom', v: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && applyFilter()}
        />
      </div>

      <div className="d-flex align-items-center gap-2">
        <label htmlFor="date-to" id="date-to-label" className="mb-0" style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>To</label>
        <input
          id="date-to"
          aria-labelledby="date-range-label date-to-label"
          type="datetime-local"
          className="ol-input"
          style={{ width: '100%', maxWidth: 190 }}
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

      {/* Not --ghost: this toolbar's own background is --ol-surface-2, which is
          exactly what .ol-btn--ghost hovers to, so a ghost button would read as
          plain text here and gain almost nothing on hover. */}
      {isFiltered && (
        <button type="button" className="ol-btn ol-btn--sm" onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      )}

      <span
        className="ms-auto"
        aria-live="polite"
        style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}
      >
        {isFiltered ? (
          <>
            <span style={{ color: 'var(--ol-text)', fontWeight: 600 }}>{filteredTotal.toLocaleString()}</span>
            {' of '}{overallTotal?.toLocaleString()}{' entries'}
          </>
        ) : dataDateRange.min ? (
          <span className="font-mono" aria-label={`Data spans ${dataDateRange.min} to ${dataDateRange.max}`}>
            {dataDateRange.min} — {dataDateRange.max}
          </span>
        ) : null}
      </span>
    </div>
  );
}
