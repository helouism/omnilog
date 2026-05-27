import { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LogEntry, FilterState, SeverityLevel } from '../../types/log.types';
import { FilterBar } from './FilterBar';

interface VirtualLogTableProps {
  entries: LogEntry[];
}

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  FATAL: 'text-purple',
  ERROR: 'text-danger',
  WARN: 'text-warning',
  INFO: 'text-info',
  DEBUG: 'text-secondary',
  TRACE: 'text-muted',
  UNKNOWN: 'text-muted',
};

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  FATAL: 'bg-purple',
  ERROR: 'bg-danger',
  WARN: 'bg-warning text-dark',
  INFO: 'bg-info text-dark',
  DEBUG: 'bg-secondary',
  TRACE: 'bg-dark text-muted',
  UNKNOWN: 'bg-dark text-muted',
};

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  FATAL: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5, UNKNOWN: 6,
};

const INITIAL_FILTER: FilterState = {
  query: '',
  isRegex: false,
  severities: [],
  statusRange: null,
  dateFrom: null,
  dateTo: null,
  ipCidr: '',
};

type SortColumn = 'id' | 'timestamp' | 'severity' | 'ip' | 'method' | 'status';
type SortDir = 'asc' | 'desc';

function formatTs(ts: Date | null): string {
  if (!ts) return '—';
  return ts.toISOString().replace('T', ' ').slice(0, 19);
}

function exportCsv(entries: LogEntry[], filename: string) {
  const cols = ['id', 'timestamp', 'severity', 'ip', 'method', 'path', 'status', 'message', 'raw'];
  const rows = entries.map(e => cols.map(c => {
    const v = (e as unknown as Record<string, unknown>)[c];
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }).join(','));
  const csv = [cols.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <i className="bi bi-chevron-expand ms-1 opacity-25" style={{ fontSize: '0.6rem' }} />;
  return dir === 'asc'
    ? <i className="bi bi-chevron-up ms-1" style={{ fontSize: '0.6rem' }} />
    : <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.6rem' }} />;
}

export function VirtualLogTable({ entries }: VirtualLogTableProps) {
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const parentRef = useRef<HTMLDivElement>(null);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filter.severities.length > 0) {
      result = result.filter(e => filter.severities.includes(e.severity));
    }

    if (filter.query) {
      try {
        const re = filter.isRegex
          ? new RegExp(filter.query, 'i')
          : new RegExp(filter.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        result = result.filter(e => re.test(e.raw));
      } catch {
        // Invalid regex — skip
      }
    }

    if (filter.dateFrom) {
      result = result.filter(e => e.timestamp != null && e.timestamp >= filter.dateFrom!);
    }
    if (filter.dateTo) {
      result = result.filter(e => e.timestamp != null && e.timestamp <= filter.dateTo!);
    }

    return result;
  }, [entries, filter]);

  const displayEntries = useMemo(() => {
    if (!sortColumn) return filteredEntries;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredEntries].sort((a, b) => {
      if (sortColumn === 'severity') {
        return dir * (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      }
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (av == null && bv == null) return 0;
      if (av == null) return dir;
      if (bv == null) return -dir;
      if (av instanceof Date && bv instanceof Date) return dir * (av.getTime() - bv.getTime());
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
  }, [filteredEntries, sortColumn, sortDir]);

  const ROW_HEIGHT = 36;

  const virtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const handleExport = useCallback(() => {
    exportCsv(displayEntries, 'omnilog-export.csv');
  }, [displayEntries]);

  const items = virtualizer.getVirtualItems();

  function colHeader(label: string, col: SortColumn, width: number) {
    const active = sortColumn === col;
    return (
      <span
        style={{ width, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}
        className={active ? 'text-light' : 'text-muted'}
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon active={active} dir={sortDir} />
      </span>
    );
  }

  return (
    <div className="d-flex flex-column h-100">
      <FilterBar
        filter={filter}
        onChange={setFilter}
        totalRows={entries.length}
        filteredRows={displayEntries.length}
        onExportCsv={handleExport}
      />

      <div className="table-header d-flex px-3 py-1 border-bottom border-secondary small" style={{ fontSize: '0.7rem' }}>
        {colHeader('ID', 'id', 55)}
        {colHeader('TIMESTAMP', 'timestamp', 155)}
        {colHeader('SEVERITY', 'severity', 80)}
        {colHeader('IP', 'ip', 120)}
        {colHeader('METHOD', 'method', 65)}
        {colHeader('STATUS', 'status', 65)}
        <span className="flex-grow-1 text-muted" style={{ userSelect: 'none' }}>MESSAGE / PATH</span>
      </div>

      <div
        ref={parentRef}
        className="flex-grow-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map(vRow => {
            const entry = displayEntries[vRow.index];
            return (
              <div
                key={vRow.key}
                data-index={vRow.index}
                ref={virtualizer.measureElement}
                className={`log-row d-flex align-items-center px-3 border-bottom border-secondary border-opacity-25 ${SEVERITY_CLASS[entry.severity]}`}
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                <span className="text-muted" style={{ width: 55, flexShrink: 0 }}>{entry.id}</span>
                <span style={{ width: 155, flexShrink: 0 }}>{formatTs(entry.timestamp)}</span>
                <span style={{ width: 80, flexShrink: 0 }}>
                  <span className={`badge ${SEVERITY_BADGE[entry.severity]}`} style={{ fontSize: '0.65rem' }}>
                    {entry.severity}
                  </span>
                </span>
                <span className="text-info" style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.ip ?? '—'}
                </span>
                <span className="text-warning" style={{ width: 65, flexShrink: 0 }}>{entry.method ?? '—'}</span>
                <span style={{ width: 65, flexShrink: 0 }}>{entry.status ?? '—'}</span>
                <span className="flex-grow-1 text-truncate opacity-75">
                  {entry.path ?? entry.message ?? entry.raw.slice(0, 200)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
