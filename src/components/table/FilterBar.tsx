import type { FilterState, SeverityLevel } from '../../types/log.types';
import { Search, Regex, Download } from '../icons';

interface FilterBarProps {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  totalRows: number;
  filteredRows: number;
  onExportCsv: () => void;
}

const ALL_SEVERITIES: SeverityLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN'];

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  FATAL: 'ol-chip--fatal',
  ERROR: 'ol-chip--error',
  WARN: 'ol-chip--warn',
  INFO: 'ol-chip--info',
  DEBUG: 'ol-chip--debug',
  TRACE: 'ol-chip--trace',
  UNKNOWN: 'ol-chip--unknown',
};

export function FilterBar({ filter, onChange, totalRows, filteredRows, onExportCsv }: FilterBarProps) {
  const toggleSeverity = (s: SeverityLevel) => {
    const next = filter.severities.includes(s)
      ? filter.severities.filter(x => x !== s)
      : [...filter.severities, s];
    onChange({ ...filter, severities: next });
  };

  const isFiltered = filteredRows < totalRows;

  return (
    <div
      className="d-flex flex-wrap align-items-center gap-3 px-4 py-2"
      style={{ background: 'var(--ol-surface-2)', borderBottom: '1px solid var(--ol-border)' }}
    >
      <div className="d-flex align-items-center gap-2">
        <span style={{ color: 'var(--ol-text-faint)' }}>
          {filter.isRegex ? <Regex size={14} /> : <Search size={14} />}
        </span>
        <input
          type="text"
          className="ol-input"
          style={{ width: 260 }}
          placeholder={filter.isRegex ? 'Regex pattern…' : 'Search logs…'}
          aria-label="Search logs"
          value={filter.query}
          onChange={e => onChange({ ...filter, query: e.target.value })}
        />
        <button
          type="button"
          className={['ol-btn', 'ol-btn--sm', filter.isRegex && 'ol-btn--primary'].filter(Boolean).join(' ')}
          aria-label="Toggle regex mode"
          title="Toggle regex mode"
          aria-pressed={filter.isRegex}
          onClick={() => onChange({ ...filter, isRegex: !filter.isRegex })}
        >
          <Regex size={13} />
        </button>
      </div>

      <div className="d-flex flex-wrap gap-1 align-items-center">
        {ALL_SEVERITIES.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={filter.severities.includes(s)}
            className={['ol-chip', 'ol-chip--interactive', filter.severities.includes(s) && SEVERITY_CLASS[s]].filter(Boolean).join(' ')}
            onClick={() => toggleSeverity(s)}
          >
            {s}
          </button>
        ))}
        {/* Plain .ol-btn, not --ghost: this bar's background is --ol-surface-2,
            exactly what a ghost button hovers to. Matches the Clear button in
            DateRangeFilter so the two toolbars read the same. */}
        {filter.severities.length > 0 && (
          <button
            type="button"
            className="ol-btn ol-btn--sm"
            onClick={() => onChange({ ...filter, severities: [] })}
          >
            Clear
          </button>
        )}
      </div>

      <div className="d-flex align-items-center gap-3 ms-auto">
        <span style={{ fontSize: 'var(--ol-fs-xs)', color: 'var(--ol-text-faint)' }}>
          {isFiltered ? (
            <><span style={{ color: 'var(--ol-text)', fontWeight: 600 }}>{filteredRows.toLocaleString()}</span> of {totalRows.toLocaleString()}</>
          ) : (
            <>{totalRows.toLocaleString()} rows</>
          )}
        </span>
        <button type="button" className="ol-btn ol-btn--sm" title="Export filtered rows as CSV" onClick={onExportCsv}>
          <Download size={13} />CSV
        </button>
      </div>
    </div>
  );
}
