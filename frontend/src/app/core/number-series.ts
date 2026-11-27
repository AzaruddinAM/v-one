import { NumberSeries } from './api/models';

/** Client copy of NumberGenerator::renderPrefix, for live previews in Settings. */
export function renderPrefix(prefix: string, date: Date, code: string, fyStartMonth = 4): string {
  const yyyy = String(date.getFullYear());
  const month = date.getMonth() + 1;
  const fyStart = month >= fyStartMonth ? date.getFullYear() : date.getFullYear() - 1;
  const fy = fyStartMonth === 1 ? yyyy.slice(2) : `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
  return prefix
    .replaceAll('{YYYY}', yyyy)
    .replaceAll('{YY}', yyyy.slice(2))
    .replaceAll('{MM}', String(month).padStart(2, '0'))
    .replaceAll('{FY}', fy)
    .replaceAll('{CODE}', code.toUpperCase() || 'XX');
}

export function previewNumber(s: NumberSeries, date: Date, code: string, fyStartMonth = 4): string {
  return renderPrefix(s.prefix, date, code, fyStartMonth) + String(Math.max(1, s.next || 1)).padStart(Math.min(10, Math.max(1, s.digits || 5)), '0');
}
