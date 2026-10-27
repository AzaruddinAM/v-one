import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthStore } from '../core/auth/auth.store';

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number | string | null | undefined, currency = 'INR', withSymbol = true): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
  const key = `${currency}|${withSymbol}`;
  let f = formatters.get(key);
  if (!f) {
    f = withSymbol
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(key, f);
  }
  return f.format(n);
}

/** Formats amounts in the organization's currency with Indian digit grouping (₹1,23,456.00). */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly auth = inject(AuthStore, { optional: true });

  transform(value: number | string | null | undefined, withSymbol = true): string {
    return formatMoney(value, this.auth?.currency() ?? 'INR', withSymbol);
  }
}
