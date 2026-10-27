/** Local yyyy-MM-dd (avoids the UTC shift of toISOString()). */
export function isoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function fiscalYearStart(month = 4, today = new Date()): string {
  const year = today.getMonth() + 1 >= month ? today.getFullYear() : today.getFullYear() - 1;
  return isoDate(new Date(year, month - 1, 1));
}
