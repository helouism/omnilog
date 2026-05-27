import type { AggregationResult } from '../../types/log.types';

interface StatCardsProps {
  agg: AggregationResult;
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

export function StatCards({ agg }: StatCardsProps) {
  const errorCount = agg.severityDistribution
    .filter(s => s.severity === 'ERROR' || s.severity === 'FATAL')
    .reduce((acc, s) => acc + s.count, 0);

  const errorRate = pct(errorCount, agg.parsedLines);
  const parseRate = pct(agg.parsedLines, agg.totalLines);

  const cards = [
    {
      label: 'Total Lines',
      value: agg.totalLines.toLocaleString(),
      icon: 'bi-list-ul',
      color: 'text-primary',
    },
    {
      label: 'Parsed',
      value: `${agg.parsedLines.toLocaleString()} (${parseRate})`,
      icon: 'bi-check-circle-fill',
      color: 'text-success',
    },
    {
      label: 'Errors / Fatal',
      value: `${errorCount.toLocaleString()} (${errorRate})`,
      icon: 'bi-exclamation-octagon-fill',
      color: 'text-danger',
    },
    {
      label: 'Format',
      value: agg.format.toUpperCase(),
      icon: 'bi-braces',
      color: 'text-info',
    },
  ];

  return (
    <div className="row g-3 mb-3">
      {cards.map(card => (
        <div className="col-6 col-md-3" key={card.label}>
          <div className="card bg-dark border-secondary h-100">
            <div className="card-body p-3">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="text-muted small mb-1">{card.label}</div>
                  <div className="fw-semibold">{card.value}</div>
                </div>
                <i className={`bi ${card.icon} ${card.color} fs-5 opacity-75`} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
