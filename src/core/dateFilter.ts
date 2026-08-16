/** State + reducer backing the dashboard date-range toolbar (`DateRangeFilter`). */

export type DateFilter = { dateFrom: string; dateTo: string; appliedFrom: string; appliedTo: string };

export type DateAction =
  | { type: 'setFrom'; v: string }
  | { type: 'setTo'; v: string }
  | { type: 'apply' }
  | { type: 'clear' };

export const INIT_DATE: DateFilter = { dateFrom: '', dateTo: '', appliedFrom: '', appliedTo: '' };

export function dateReducer(s: DateFilter, a: DateAction): DateFilter {
  switch (a.type) {
    case 'setFrom': return { ...s, dateFrom: a.v };
    case 'setTo': return { ...s, dateTo: a.v };
    case 'apply': return { ...s, appliedFrom: s.dateFrom, appliedTo: s.dateTo };
    case 'clear': return INIT_DATE;
  }
}
