import type { AggregationResult } from '../../types/log.types';

interface StatCardsProps {
  agg: AggregationResult;
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

/** Four-cell hairline strip. Deliberately monochrome — the only cell that ever
 *  takes color is Errors, and only when the count is non-zero. */
export function StatCards({ agg }: StatCardsProps) {
  const errorCount = agg.severityDistribution
    .filter(s => s.severity === 'ERROR' || s.severity === 'FATAL')
    .reduce((acc, s) => acc + s.count, 0);

  const cards: { label: string; value: string; sub?: string; alert?: boolean }[] = [
    {
      label: 'Total lines',
      value: agg.totalLines.toLocaleString(),
    },
    {
      label: 'Parsed',
      value: agg.parsedLines.toLocaleString(),
      sub: pct(agg.parsedLines, agg.totalLines),
    },
    {
      label: 'Errors / fatal',
      value: errorCount.toLocaleString(),
      sub: pct(errorCount, agg.parsedLines),
      alert: errorCount > 0,
    },
    {
      label: 'Format',
      value: agg.format.toUpperCase(),
    },
  ];

  return (
    <div className="ol-grid ol-grid--quad mb-4">
      {cards.map(card => (
        <div className="ol-grid-cell" key={card.label}>
          <div className="ol-stat-label">{card.label}</div>
          <div className={`ol-stat-value ${card.alert ? 'ol-stat-value--alert' : ''}`}>
            {card.value}
          </div>
          {card.sub && <div className="ol-stat-sub">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}
