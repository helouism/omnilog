import { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LogEntry, FilterState, SeverityLevel } from '../../types/log.types';
import { FilterBar } from './FilterBar';
import { ChevronDown, ChevronRight, ChevronUp, ChevronExpand } from '../icons';

interface VirtualLogTableProps {
  entries: LogEntry[];
}

const SEVERITY_CHIP: Record<SeverityLevel, string> = {
  FATAL: 'ol-chip--fatal',
  ERROR: 'ol-chip--error',
  WARN: 'ol-chip--warn',
  INFO: 'ol-chip--info',
  DEBUG: 'ol-chip--debug',
  TRACE: 'ol-chip--trace',
  UNKNOWN: 'ol-chip--unknown',
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

// No opacity on the inactive icon: .ol-sort-btn inherits --ol-text-faint from
// .ol-table-head and brightens to --ol-text via .is-active, so the active/inactive
// contrast is already carried by colour. Spacing comes from .ol-sort-btn's gap.
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronExpand size={11} />;
  return dir === 'asc'
    ? <ChevronUp size={11} />
    : <ChevronDown size={11} />;
}

export function VirtualLogTable({ entries }: VirtualLogTableProps) {
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      // Built once per filter change rather than rescanned for each of the
      // (potentially millions of) entries.
      const selected = new Set(filter.severities);
      result = result.filter(e => selected.has(e.severity));
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
    return filteredEntries.toSorted((a, b) => {
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
      <button
        type="button"
        className={['ol-sort-btn', active && 'is-active'].filter(Boolean).join(' ')}
        style={{ width }}
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon active={active} dir={sortDir} />
      </button>
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

      <div className="ol-table-head">
        <span style={{ width: 20, flexShrink: 0 }} />
        {colHeader('ID', 'id', 55)}
        {colHeader('TIMESTAMP', 'timestamp', 155)}
        {colHeader('SEVERITY', 'severity', 80)}
        {colHeader('IP', 'ip', 120)}
        {colHeader('METHOD', 'method', 65)}
        {colHeader('STATUS', 'status', 65)}
        <span className="flex-grow-1" style={{ userSelect: 'none' }}>MESSAGE / PATH</span>
      </div>

      <div
        ref={parentRef}
        className="flex-grow-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map(vRow => {
            const entry = displayEntries[vRow.index];
            const isExpanded = expandedIds.has(entry.id);
            return (
              <div
                key={vRow.key}
                data-index={vRow.index}
                ref={virtualizer.measureElement}
                className="ol-row"
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  left: 0,
                  right: 0,
                  ...(isExpanded ? { minHeight: ROW_HEIGHT } : { height: ROW_HEIGHT }),
                  // --ol-fs-xs is 0.75rem, byte-for-byte the previous value, so row
                  // metrics and the ROW_HEIGHT virtualizer constant are unchanged.
                  // Mono is applied per-cell below, not to the whole row: the old
                  // row-level `monospace` keyword also bypassed the self-hosted
                  // JetBrains Mono that .font-mono resolves to.
                  fontSize: 'var(--ol-fs-xs)',
                }}
              >
                <div className="d-flex align-items-center px-3" style={{ height: ROW_HEIGHT }}>
                  <button
                    type="button"
                    className="ol-row-toggle"
                    style={{ width: 20 }}
                    aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(entry.id)}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  <span style={{ width: 55, flexShrink: 0, color: 'var(--ol-text-faint)', fontVariantNumeric: 'tabular-nums' }}>{entry.id}</span>
                  <span className="font-mono" style={{ width: 155, flexShrink: 0 }}>{formatTs(entry.timestamp)}</span>
                  <span style={{ width: 80, flexShrink: 0 }}>
                    <span className={`ol-chip ${SEVERITY_CHIP[entry.severity]}`}>
                      {entry.severity}
                    </span>
                  </span>
                  <span className="font-mono" style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.ip ?? '—'}
                  </span>
                  <span style={{ width: 65, flexShrink: 0 }}>{entry.method ?? '—'}</span>
                  <span style={{ width: 65, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{entry.status ?? '—'}</span>
                  <span className="flex-grow-1 text-truncate font-mono" style={{ color: 'var(--ol-text-dim)' }}>
                    {entry.path ?? entry.message ?? entry.raw.slice(0, 200)}
                  </span>
                </div>
                {isExpanded && (
                  <div
                    className="px-3 pb-2"
                    style={{ borderTop: '1px solid var(--ol-border-subtle)', paddingLeft: '2.75rem' }}
                  >
                    {/* .font-mono is load-bearing here, not decorative: this is the
                        raw log line, and the row no longer sets a mono family. */}
                    <pre
                      className="mb-0 font-mono"
                      style={{ fontSize: 'var(--ol-fs-xs)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--ol-text-dim)' }}
                    >
                      {entry.raw}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
