import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import type { AggregationResult } from '../../types/log.types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

/**
 * Chart palette, read from the CSS custom properties in _tokens.scss so there
 * is one source of truth for color.
 *
 * The fallback is REQUIRED, not defensive: scripts/prerender.mjs renders every
 * route through renderToString with no DOM, where getComputedStyle is
 * unavailable. Keep these values in sync with src/assets/_tokens.scss.
 */
const TOKEN_FALLBACK: Record<string, string> = {
  '--ol-text-dim': '#98a2b0',
  '--ol-text-faint': '#7d8797',
  '--ol-surface-1': '#12151b',
  '--ol-grid-line': 'rgba(255,255,255,0.05)',
  '--ol-accent': '#58a6ff',
  '--ol-accent-fill': 'rgba(88,166,255,0.55)',
  '--ol-sev-trace': '#78838f',
  '--ol-sev-debug': '#8b95a3',
  '--ol-sev-info': '#6e9fd4',
  '--ol-sev-warn': '#d9a441',
  '--ol-sev-error': '#e5534b',
  '--ol-sev-fatal': '#a371f7',
  '--ol-sev-unknown': '#7d8797',
  '--ol-sev-trace-fill': 'rgba(120,131,143,0.55)',
  '--ol-sev-debug-fill': 'rgba(139,149,163,0.55)',
  '--ol-sev-info-fill': 'rgba(110,159,212,0.55)',
  '--ol-sev-warn-fill': 'rgba(217,164,65,0.55)',
  '--ol-sev-error-fill': 'rgba(229,83,75,0.55)',
  '--ol-sev-fatal-fill': 'rgba(163,113,247,0.55)',
  '--ol-sev-unknown-fill': 'rgba(125,135,151,0.55)',
  '--ol-status-2xx-fill': 'rgba(63,185,80,0.55)',
  '--ol-status-3xx-fill': 'rgba(110,159,212,0.55)',
  '--ol-status-4xx-fill': 'rgba(217,164,65,0.55)',
  '--ol-status-5xx-fill': 'rgba(229,83,75,0.55)',
};

type TokenReader = (name: string) => string;

function useChartTokens(): TokenReader {
  return useMemo(() => {
    let computed: CSSStyleDeclaration | null = null;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      computed = getComputedStyle(document.documentElement);
    }
    return (name: string) => {
      const v = computed?.getPropertyValue(name).trim();
      return v || TOKEN_FALLBACK[name] || '#000000';
    };
  }, []);
}

/**
 * Shared chart.js options. A function rather than a module constant because
 * every color it carries now comes from the token reader.
 */
function chartDefaults(t: TokenReader) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 } as const,
    plugins: {
      legend: {
        labels: { color: t('--ol-text-dim'), font: { size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: t('--ol-text-faint'), maxTicksLimit: 8, font: { size: 10 } },
        grid: { color: t('--ol-grid-line') },
      },
      y: {
        ticks: { color: t('--ol-text-faint'), font: { size: 10 } },
        grid: { color: t('--ol-grid-line') },
      },
    },
  };
}

interface ChartsProps {
  agg: AggregationResult;
}

type Granularity = 'minute' | 'hour' | 'day';

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'minute', label: 'Min' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
];

export function TimeSeriesChart({ agg }: ChartsProps) {
  const [granularity, setGranularity] = useState<Granularity>('minute');
  const t = useChartTokens();

  const { labels, requestData, errorData } = useMemo(() => {
    if (granularity === 'minute') {
      return {
        labels: agg.timeSeries.map(b => b.timestamp.slice(11, 16)),
        requestData: agg.timeSeries.map(b => b.requests),
        errorData: agg.timeSeries.map(b => b.errors),
      };
    }
    const buckets = new Map<string, { requests: number; errors: number }>();
    for (const b of agg.timeSeries) {
      const key = granularity === 'hour'
        ? b.timestamp.slice(0, 13)  // YYYY-MM-DDTHH
        : b.timestamp.slice(0, 10); // YYYY-MM-DD
      const existing = buckets.get(key) ?? { requests: 0, errors: 0 };
      existing.requests += b.requests;
      existing.errors += b.errors;
      buckets.set(key, existing);
    }
    const sorted = [...buckets.entries()].toSorted((a, b) => a[0].localeCompare(b[0]));
    const labelOf = (key: string) =>
      granularity === 'hour' ? key.replace('T', ' ') + ':00' : key;
    return {
      labels: sorted.map(([k]) => labelOf(k)),
      requestData: sorted.map(([, v]) => v.requests),
      errorData: sorted.map(([, v]) => v.errors),
    };
  }, [agg.timeSeries, granularity]);

  const data = {
    labels,
    datasets: [
      {
        label: 'Requests',
        data: requestData,
        borderColor: t('--ol-accent'),
        backgroundColor: t('--ol-accent-fill'),
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 200 ? 0 : 2,
        borderWidth: 1.5,
      },
      {
        label: 'Errors',
        data: errorData,
        borderColor: t('--ol-sev-error'),
        backgroundColor: t('--ol-sev-error-fill'),
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 200 ? 0 : 2,
        borderWidth: 1.5,
      },
    ],
  };

  return (
    <div className="ol-panel ol-panel-pad h-100">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="ol-label">Request / error trend</div>
        <div className="ol-seg">
          {GRANULARITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`ol-seg-item ${granularity === opt.value ? 'is-active' : ''}`}
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 220 }}>
        <Line
          data={data}
          options={chartDefaults(t)}
          role="img"
          aria-label="Line chart of request and error counts over time"
        />
      </div>
    </div>
  );
}

export function TopIPsChart({ agg }: ChartsProps) {
  const t = useChartTokens();
  if (!agg.topIPs.length) return null;
  const defaults = chartDefaults(t);
  const data = {
    labels: agg.topIPs.map(d => d.ip),
    datasets: [{
      label: 'Requests',
      data: agg.topIPs.map(d => d.count),
      backgroundColor: t('--ol-accent-fill'),
      borderColor: t('--ol-accent'),
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  return (
    <div className="ol-panel ol-panel-pad h-100">
      <div className="ol-label mb-3">Top 10 source IPs</div>
      <div style={{ height: 200 }}>
        <Bar
          data={data}
          options={{
            ...defaults,
            indexAxis: 'y' as const,
            plugins: { ...defaults.plugins, legend: { display: false } },
            scales: {
              x: defaults.scales.x,
              y: {
                ticks: { color: t('--ol-text-dim'), font: { size: 10 } },
                grid: { color: t('--ol-grid-line') },
              },
            },
          }}
          role="img"
          aria-label="Horizontal bar chart of the ten source IP addresses with the most requests"
        />
      </div>
    </div>
  );
}

export function StatusDistributionChart({ agg }: ChartsProps) {
  const t = useChartTokens();
  if (!agg.statusDistribution.length) return null;

  const STATUS_FILL: Record<string, string> = {
    '2xx': t('--ol-status-2xx-fill'),
    '3xx': t('--ol-status-3xx-fill'),
    '4xx': t('--ol-status-4xx-fill'),
    '5xx': t('--ol-status-5xx-fill'),
  };

  const data = {
    labels: agg.statusDistribution.map(d => d.status),
    datasets: [{
      data: agg.statusDistribution.map(d => d.count),
      backgroundColor: agg.statusDistribution.map(
        d => STATUS_FILL[d.status] ?? t('--ol-sev-unknown-fill'),
      ),
      borderColor: t('--ol-surface-1'),
      borderWidth: 2,
    }],
  };

  return (
    <div className="ol-panel ol-panel-pad h-100">
      <div className="ol-label mb-3">HTTP status distribution</div>
      <div style={{ height: 220 }} className="d-flex justify-content-center">
        <Doughnut
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
              legend: { labels: { color: t('--ol-text-dim'), font: { size: 11 } } },
            },
          }}
          role="img"
          aria-label="Doughnut chart of log entries grouped by HTTP status class"
        />
      </div>
    </div>
  );
}

export function ChartsGrid({ agg }: ChartsProps) {
  return (
    <div className="row g-3">
      <div className="col-12 col-lg-8"><TimeSeriesChart agg={agg} /></div>
      <div className="col-12 col-lg-4"><StatusDistributionChart agg={agg} /></div>
      <div className="col-12 col-lg-6"><TopIPsChart agg={agg} /></div>
      <div className="col-12 col-lg-6"><SeverityChart agg={agg} /></div>
    </div>
  );
}

export default ChartsGrid;

export function SeverityChart({ agg }: ChartsProps) {
  const t = useChartTokens();
  if (!agg.severityDistribution.length) return null;

  const SEVERITY_FILL: Record<string, string> = {
    FATAL: t('--ol-sev-fatal-fill'),
    ERROR: t('--ol-sev-error-fill'),
    WARN: t('--ol-sev-warn-fill'),
    INFO: t('--ol-sev-info-fill'),
    DEBUG: t('--ol-sev-debug-fill'),
    TRACE: t('--ol-sev-trace-fill'),
    UNKNOWN: t('--ol-sev-unknown-fill'),
  };

  const defaults = chartDefaults(t);
  const sorted = agg.severityDistribution.toSorted((a, b) => b.count - a.count);
  const data = {
    labels: sorted.map(d => d.severity),
    datasets: [{
      label: 'Count',
      data: sorted.map(d => d.count),
      backgroundColor: sorted.map(
        d => SEVERITY_FILL[d.severity] ?? t('--ol-sev-unknown-fill'),
      ),
      borderColor: t('--ol-surface-1'),
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  return (
    <div className="ol-panel ol-panel-pad h-100">
      <div className="ol-label mb-3">Severity distribution</div>
      <div style={{ height: 200 }}>
        <Bar
          data={data}
          options={{
            ...defaults,
            plugins: { ...defaults.plugins, legend: { display: false } },
          }}
          role="img"
          aria-label="Bar chart of log entry counts by severity level"
        />
      </div>
    </div>
  );
}
