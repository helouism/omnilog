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

/**
 * Column widths in px. The header buttons and the row cells read the same
 * constant so the two can never drift.
 *
 * A header cell is an inline-flex `.ol-sort-btn` with `flex-shrink: 0`, and its
 * content is label + gap + sort chevron. A box narrower than that content
 * overflows into the next column instead of shrinking, so METHOD/STATUS have to
 * fit six uppercase glyphs *plus* the 11px chevron, not just the label.
 * SEVERITY holds a chip rather than text, so it is sized by the chip's longest
 * label ("UNKNOWN") plus its 0.45rem padding and 1px border on each side.
 */
const COL = {
  toggle: 20,
  id: 55,
  timestamp: 155,
  severity: 88,
  ip: 120,
  method: 76,
  status: 76,
} as const;

/**
 * Row pitch, and — less obviously — an accessibility constraint.
 *
 * `.ol-row-toggle` renders 20x11 CSS px, well under SC 2.5.8's 24x24 floor. It
 * passes only under that criterion's *spacing* exception: a 24px-diameter circle
 * centred on each undersized target must not intersect another target's circle.
 * The nearest neighbour of any toggle is the toggle one row away, so the margin
 * is exactly ROW_HEIGHT. Measured against the live DOM this is the tightest
 * target spacing on the page — 36px against a 24px requirement.
 *
 * Reducing this below 24 therefore turns every row toggle into a real SC 2.5.8
 * failure. `npm run check` cannot see it: the contrast checkers read colours, not
 * geometry, and target size is the one floor AGENTS.md flags as hand-checked.
 * Either keep it >= 24 or give `.ol-row-toggle` a genuine 24x24 box first.
 */
const ROW_HEIGHT = 36;

// `.ol-row` carries a 1px border-bottom, and box-sizing is border-box globally,
// so its 36px declared height leaves a 35px content box. An inner wrapper at the
// full ROW_HEIGHT overflows that box by exactly the border.
const ROW_INNER_HEIGHT = ROW_HEIGHT - 1;

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
    // aria-sort is the idiomatic way to expose this, but it is only valid on a
    // columnheader/rowheader role, and this is a virtualised list of divs with
    // no table semantics -- putting it here would be inert. Until the list gains
    // a real grid role, the state goes in the button's accessible name, which
    // works on a plain button. The visible label stays the bare column name.
    const sortState = active
      ? `, sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}`
      : '';
    return (
      <button
        type="button"
        className={['ol-sort-btn', active && 'is-active'].filter(Boolean).join(' ')}
        style={{ width }}
        aria-label={`Sort by ${label}${sortState}`}
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
        <span style={{ width: COL.toggle, flexShrink: 0 }} />
        {colHeader('ID', 'id', COL.id)}
        {colHeader('TIMESTAMP', 'timestamp', COL.timestamp)}
        {colHeader('SEVERITY', 'severity', COL.severity)}
        {colHeader('IP', 'ip', COL.ip)}
        {colHeader('METHOD', 'method', COL.method)}
        {colHeader('STATUS', 'status', COL.status)}
        <span className="flex-grow-1" style={{ userSelect: 'none' }}>MESSAGE / PATH</span>
      </div>

      <div
        ref={parentRef}
        className="flex-grow-1 overflow-auto"
        role="region"
        aria-label="Log entries"
        tabIndex={0}
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
                <div className="d-flex align-items-center px-3" style={{ height: ROW_INNER_HEIGHT }}>
                  <button
                    type="button"
                    className="ol-row-toggle"
                    style={{ width: COL.toggle }}
                    aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(entry.id)}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  {/* No fontVariantNumeric here or on STATUS: body already sets
                      tabular-nums globally and it inherits. */}
                  <span style={{ width: COL.id, flexShrink: 0, color: 'var(--ol-text-faint)' }}>{entry.id}</span>
                  <span className="font-mono" style={{ width: COL.timestamp, flexShrink: 0 }}>{formatTs(entry.timestamp)}</span>
                  <span style={{ width: COL.severity, flexShrink: 0 }}>
                    <span className={`ol-chip ${SEVERITY_CHIP[entry.severity]}`}>
                      {entry.severity}
                    </span>
                  </span>
                  <span className="font-mono" style={{ width: COL.ip, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.ip ?? '—'}
                  </span>
                  <span style={{ width: COL.method, flexShrink: 0 }}>{entry.method ?? '—'}</span>
                  <span style={{ width: COL.status, flexShrink: 0 }}>{entry.status ?? '—'}</span>
                  <span className="flex-grow-1 text-truncate font-mono" style={{ color: 'var(--ol-text-dim)' }}>
                    {entry.path ?? entry.message ?? entry.raw.slice(0, 200)}
                  </span>
                </div>
                {isExpanded && (
                  <div
                    className="pb-2"
                    style={{
                      borderTop: '1px solid var(--ol-border-subtle)',
                      // px-3 dropped from the className: Bootstrap's spacing
                      // utilities are !important, so the inline paddingLeft that
                      // was here alongside it never applied. Both paddings are
                      // inline now, derived from the same constants as the row
                      // above so the raw line starts under the ID column.
                      paddingLeft: `calc(var(--ol-sp-4) + ${COL.toggle}px)`,
                      paddingRight: 'var(--ol-sp-4)',
                    }}
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
