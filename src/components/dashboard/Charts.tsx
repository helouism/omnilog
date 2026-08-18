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
import type { ChartOptions } from 'chart.js';
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
 * Chart palette mirror, kept in sync with src/assets/_tokens.scss by
 * `npm run check:tokens`. That check is what earns this map its place as the one
 * sanctioned exception to the branch rule that no color literal may live outside
 * _tokens.scss — without it the map would drift silently, since nothing at
 * runtime reads it today.
 *
 * It is insurance for a no-DOM render, NOT a path that currently executes. Being
 * precise about that matters, because the obvious guess is wrong: this module is
 * behind React.lazy in MainPage, and prerender only ever reaches the idle
 * LandingView, so Charts is never evaluated server-side (`grep ol-accent-fill
 * dist/server/entry-server.js` → 0 hits). A green `npm run build` therefore
 * proves nothing about the fallback — doubly so because prerender.mjs catches
 * per-route errors and continues, so a throwing route would not fail the build
 * at all. The guard exists so that moving the lazy boundary cannot break SSR.
 */
const TOKEN_FALLBACK: Record<string, string> = {
  '--ol-text-dim': '#98a2b0',
  '--ol-text-faint': '#7d8797',
  '--ol-surface-1': '#12151b',
  '--ol-grid-line': 'rgba(255,255,255,0.05)',
  '--ol-accent': '#58a6ff',
  '--ol-accent-fill': 'rgba(88,166,255,0.75)',
  '--ol-accent-wash': 'rgba(88,166,255,0.08)',
  '--ol-sev-trace': '#78838f',
  '--ol-sev-debug': '#8b95a3',
  '--ol-sev-info': '#6e9fd4',
  '--ol-sev-warn': '#d9a441',
  '--ol-sev-error': '#e5534b',
  '--ol-sev-fatal': '#a371f7',
  '--ol-sev-unknown': '#7d8797',
  '--ol-sev-error-wash': 'rgba(229,83,75,0.08)',
  '--ol-sev-trace-fill': 'rgba(120,131,143,0.75)',
  '--ol-sev-debug-fill': 'rgba(139,149,163,0.75)',
  '--ol-sev-info-fill': 'rgba(110,159,212,0.75)',
  '--ol-sev-warn-fill': 'rgba(217,164,65,0.75)',
  '--ol-sev-error-fill': 'rgba(229,83,75,0.75)',
  '--ol-sev-fatal-fill': 'rgba(163,113,247,0.75)',
  '--ol-sev-unknown-fill': 'rgba(125,135,151,0.75)',
  '--ol-status-2xx-fill': 'rgba(63,185,80,0.75)',
  '--ol-status-3xx-fill': 'rgba(110,159,212,0.75)',
  '--ol-status-4xx-fill': 'rgba(217,164,65,0.75)',
  '--ol-status-5xx-fill': 'rgba(229,83,75,0.75)',
};

type TokenReader = (name: string) => string;

function useChartTokens(): TokenReader {
  return useMemo(() => {
    let computed: CSSStyleDeclaration | null = null;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // A live CSSStyleDeclaration, deliberately: getPropertyValue re-resolves
      // against current computed values rather than replaying a snapshot, so a
      // token changed at runtime is picked up without re-running this memo.
      computed = getComputedStyle(document.documentElement);
    }
    return (name: string) => {
      const v = computed?.getPropertyValue(name).trim();
      if (v) return v;
      const fallback = TOKEN_FALLBACK[name];
      if (fallback) return fallback;
      // check:tokens makes this unreachable, so arriving here means a typo
      // landed without the check running. Fail loudly in dev; in production
      // degrade to a visible grey rather than black, which would be 1.06:1 on
      // --ol-surface-1 and simply vanish.
      if (import.meta.env.DEV) throw new Error(`Charts: unknown design token ${name}`);
      return TOKEN_FALLBACK['--ol-text-dim'];
    };
  }, []);
}

/**
 * Options common to every chart type, axes excluded. The doughnut consumes this
 * one directly: it has no cartesian axes, and chart.js's mergeScaleConfig
 * iterates Object.keys(options.scales), so handing it `scales` would materialise
 * an x and a y on a chart type that has neither.
 *
 * `satisfies` rather than a return-type annotation, deliberately. An annotation
 * would widen the result to ChartOptions, whose `scales` is optional — and
 * TopIPsChart reads `defaults.scales.x` directly. `satisfies` validates the
 * literal against ChartOptions (so a typo like `gird` for `grid`, which chart.js
 * would silently ignore at runtime, is a compile error) while keeping the
 * precise inferred type callers rely on. Without either, a returned literal
 * loses its freshness and gets no excess-property check at all.
 */
function baseOptions(t: TokenReader) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: { color: t('--ol-text-dim'), font: { size: 11 } },
      },
    },
  } satisfies ChartOptions<'line' | 'bar' | 'doughnut'>;
}

/** baseOptions plus the shared cartesian axes, for the line and bar charts. */
function chartDefaults(t: TokenReader) {
  return {
    ...baseOptions(t),
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
  } satisfies ChartOptions<'line' | 'bar'>;
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

  // Both datasets fill to the origin, so their areas overlap everywhere, and
  // chart.js paints dataset 0 LAST (_drawDatasets iterates metasets in reverse)
  // — the requests area lands on top of the errors line. Hence *-wash (8%) here
  // and not *-fill (75%): at fill weight the errors series, which is the whole
  // point of the second dataset, drops to 1.63:1 against the blue above it.
  // The solid borderColor is what carries each series; the area only hints at
  // volume. See the two-weight note in _tokens.scss.
  const data = {
    labels,
    datasets: [
      {
        label: 'Requests',
        data: requestData,
        borderColor: t('--ol-accent'),
        backgroundColor: t('--ol-accent-wash'),
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 200 ? 0 : 2,
        borderWidth: 1.5,
      },
      {
        label: 'Errors',
        data: errorData,
        borderColor: t('--ol-sev-error'),
        backgroundColor: t('--ol-sev-error-wash'),
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
        {/* h2, not a div: these four titles are the dashboard's only section
            headings, under the visually-hidden h1 in MainPage. .ol-label stays
            purely presentational and wins the cascade over the h1-h6 block at
            (0,1,0) vs (0,0,1) — but Reboot's `margin-bottom: .5rem` on headings
            is not something .ol-label declares, so mb-0 here (and mb-3 on the
            other three) restores what the divs had. In this flex row the .5rem
            would have shifted the title up off the seg control's centre line. */}
        <h2 className="ol-label mb-0">Request / error trend</h2>
        {/* .is-active is a background swap and nothing else, so the selected
            granularity is conveyed by color alone. aria-pressed gives assistive
            tech the state, and role=group with a name explains what the three
            buttons relate to — otherwise they announce as a bare
            "Min / Hour / Day". */}
        <div className="ol-seg" role="group" aria-label="Time bucket granularity">
          {GRANULARITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`ol-seg-item ${granularity === opt.value ? 'is-active' : ''}`}
              aria-pressed={granularity === opt.value}
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 220 }}>
        {/* No role="img" on any of these four: react-chartjs-2 already sets it on
            the canvas it renders, and restating it would silently diverge if the
            library's default ever changed. aria-label IS forwarded (ChartProps
            extends CanvasHTMLAttributes) and is what makes the canvas legible to
            assistive tech at all. */}
        <Line
          data={data}
          options={chartDefaults(t)}
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
      <h2 className="ol-label mb-3">Top 10 source IPs</h2>
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
      <h2 className="ol-label mb-3">HTTP status distribution</h2>
      <div style={{ height: 220 }} className="d-flex justify-content-center">
        {/* baseOptions, not chartDefaults: shares the animation and legend
            styling so they cannot drift, while leaving out `scales`, which a
            doughnut must never receive. See the note on baseOptions. */}
        <Doughnut
          data={data}
          options={baseOptions(t)}
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
      <h2 className="ol-label mb-3">Severity distribution</h2>
      <div style={{ height: 200 }}>
        <Bar
          data={data}
          options={{
            ...defaults,
            plugins: { ...defaults.plugins, legend: { display: false } },
          }}
          aria-label="Bar chart of log entry counts by severity level"
        />
      </div>
    </div>
  );
}
