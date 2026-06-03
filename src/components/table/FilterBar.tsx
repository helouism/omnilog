import type { FilterState, SeverityLevel } from '../../types/log.types';

interface FilterBarProps {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  totalRows: number;
  filteredRows: number;
  onExportCsv: () => void;
}

const ALL_SEVERITIES: SeverityLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN'];

const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  FATAL: 'danger',
  ERROR: 'danger',
  WARN: 'warning',
  INFO: 'info',
  DEBUG: 'secondary',
  TRACE: 'secondary',
  UNKNOWN: 'dark',
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
    <div className="filter-bar px-3 py-2 border-bottom border-secondary">
      <div className="row g-2 align-items-center">
        <div className="col-12 col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-dark border-secondary text-muted">
              <i className={`bi ${filter.isRegex ? 'bi-regex' : 'bi-search'}`} />
            </span>
            <input
              type="text"
              className="form-control bg-dark border-secondary text-white"
              placeholder={filter.isRegex ? 'Regex pattern…' : 'Search logs…'}
              aria-label="Search logs"
              value={filter.query}
              onChange={e => onChange({ ...filter, query: e.target.value })}
            />
            <button
              type="button"
              className={`btn btn-sm ${filter.isRegex ? 'btn-primary' : 'btn-outline-secondary'}`}
              aria-label="Toggle regex mode"
              title="Toggle regex mode"
              onClick={() => onChange({ ...filter, isRegex: !filter.isRegex })}
            >
              <i className="bi bi-regex" />
            </button>
          </div>
        </div>

        <div className="col-12 col-md-5 d-flex flex-wrap gap-1 align-items-center">
          {ALL_SEVERITIES.map(s => (
            <button
              key={s}
              type="button"
              className={`btn btn-xs px-2 py-0 rounded-pill border ${filter.severities.includes(s) ? `btn-${SEVERITY_COLOR[s]}` : 'btn-outline-secondary text-muted'}`}
              style={{ fontSize: '0.75rem', lineHeight: '1.6' }}
              onClick={() => toggleSeverity(s)}
            >
              {s}
            </button>
          ))}
          {filter.severities.length > 0 && (
            <button
              type="button"
              className="btn btn-xs px-2 py-0 text-muted"
              style={{ fontSize: '0.75rem', lineHeight: '1.6' }}
              onClick={() => onChange({ ...filter, severities: [] })}
            >
              clear
            </button>
          )}
        </div>

        <div className="col-12 col-md-3 d-flex justify-content-end align-items-center gap-2">
          <span className="text-muted small">
            {isFiltered ? (
              <><span className="text-white">{filteredRows.toLocaleString()}</span> / {totalRows.toLocaleString()}</>
            ) : (
              <>{totalRows.toLocaleString()} rows</>
            )}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            title="Export filtered rows as CSV"
            onClick={onExportCsv}
          >
            <i className="bi bi-download me-1" />CSV
          </button>
        </div>
      </div>
    </div>
  );
}
