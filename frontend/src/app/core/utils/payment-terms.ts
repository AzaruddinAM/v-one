import { addDays, isoDate } from './dates';

/** Same list and rules as Document::PAYMENT_TERMS on the server. */
export const PAYMENT_TERMS: { label: string; days: number | null }[] = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
  { label: 'Net 90', days: 90 },
  { label: 'Due end of the month', days: null },
  { label: 'Due end of next month', days: null },
];

/** Due date for a terms label and document date; null for custom / unknown terms. */
export function dueDateFor(terms: string | null | undefined, date: string): string | null {
  const t = PAYMENT_TERMS.find((p) => p.label === terms);
  if (!t || !date) return null;
  if (t.days !== null) return addDays(date, t.days);
  const d = new Date(date + 'T00:00:00');
  const monthsAhead = terms === 'Due end of next month' ? 2 : 1;
  return isoDate(new Date(d.getFullYear(), d.getMonth() + monthsAhead, 0));
}

/** "Net 30" for a contact's 30 days, when it matches a standard term. */
export function termsForDays(days: number | null | undefined): string {
  if (days === 0) return 'Due on receipt';
  return PAYMENT_TERMS.find((p) => p.days === days)?.label ?? '';
}
