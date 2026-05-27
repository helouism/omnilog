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

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 } as const,
  plugins: {
    legend: {
      labels: { color: '#adb5bd', font: { size: 11 } },
    },
  },
  scales: {
    x: {
      ticks: { color: '#6c757d', maxTicksLimit: 8, font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      ticks: { color: '#6c757d', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
  },
};

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
    const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 200 ? 0 : 2,
        borderWidth: 1.5,
      },
      {
        label: 'Errors',
        data: errorData,
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220,53,69,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 200 ? 0 : 2,
        borderWidth: 1.5,
      },
    ],
  };

  return (
    <div className="card bg-dark border-secondary mb-3">
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="card-title text-secondary small mb-0">
            <i className="bi bi-graph-up me-2" />Request / Error Trend
          </h6>
          <div className="btn-group btn-group-sm">
            {GRANULARITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`btn btn-xs px-2 py-0 ${granularity === opt.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.7rem' }}
                onClick={() => setGranularity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 180 }}>
          <Line data={data} options={CHART_DEFAULTS} />
        </div>
      </div>
    </div>
  );
}

export function TopIPsChart({ agg }: ChartsProps) {
  if (!agg.topIPs.length) return null;
  const data = {
    labels: agg.topIPs.map(d => d.ip),
    datasets: [{
      label: 'Requests',
      data: agg.topIPs.map(d => d.count),
      backgroundColor: 'rgba(13,110,253,0.7)',
      borderColor: '#0d6efd',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  return (
    <div className="card bg-dark border-secondary mb-3">
      <div className="card-body p-3">
        <h6 className="card-title text-secondary small mb-3">
          <i className="bi bi-geo-alt me-2" />Top 10 Source IPs
        </h6>
        <div style={{ height: 200 }}>
          <Bar
            data={data}
            options={{
              ...CHART_DEFAULTS,
              indexAxis: 'y' as const,
              plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
              scales: {
                x: CHART_DEFAULTS.scales.x,
                y: { ticks: { color: '#adb5bd', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  '2xx': '#198754',
  '3xx': '#0dcaf0',
  '4xx': '#ffc107',
  '5xx': '#dc3545',
};

export function StatusDistributionChart({ agg }: ChartsProps) {
  if (!agg.statusDistribution.length) return null;
  const data = {
    labels: agg.statusDistribution.map(d => d.status),
    datasets: [{
      data: agg.statusDistribution.map(d => d.count),
      backgroundColor: agg.statusDistribution.map(d => STATUS_COLORS[d.status] ?? '#6c757d'),
      borderColor: '#1a1d21',
      borderWidth: 2,
    }],
  };

  return (
    <div className="card bg-dark border-secondary mb-3">
      <div className="card-body p-3">
        <h6 className="card-title text-secondary small mb-3">
          <i className="bi bi-pie-chart me-2" />HTTP Status Distribution
        </h6>
        <div style={{ height: 180 }} className="d-flex justify-content-center">
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 300 },
              plugins: {
                legend: { labels: { color: '#adb5bd', font: { size: 11 } } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  FATAL: '#6f42c1',
  ERROR: '#dc3545',
  WARN: '#ffc107',
  INFO: '#0dcaf0',
  DEBUG: '#6c757d',
  TRACE: '#adb5bd',
  UNKNOWN: '#495057',
};

export function SeverityChart({ agg }: ChartsProps) {
  if (!agg.severityDistribution.length) return null;
  const sorted = [...agg.severityDistribution].sort((a, b) => b.count - a.count);
  const data = {
    labels: sorted.map(d => d.severity),
    datasets: [{
      label: 'Count',
      data: sorted.map(d => d.count),
      backgroundColor: sorted.map(d => SEVERITY_COLORS[d.severity] ?? '#6c757d'),
      borderColor: '#1a1d21',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  return (
    <div className="card bg-dark border-secondary mb-3">
      <div className="card-body p-3">
        <h6 className="card-title text-secondary small mb-3">
          <i className="bi bi-bar-chart me-2" />Severity Distribution
        </h6>
        <div style={{ height: 160 }}>
          <Bar
            data={data}
            options={{
              ...CHART_DEFAULTS,
              plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
            }}
          />
        </div>
      </div>
    </div>
  );
}
