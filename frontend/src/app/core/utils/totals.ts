/**
 * Mirrors App\Services\DocumentCalculator on the backend so totals
 * shown while editing match what the server stores.
 */
export interface LineInput {
  quantity: number | string | null | undefined;
  rate: number | string | null | undefined;
  discount_percent?: number | string | null;
  tax_rate?: number | string | null;
}

export interface LineResult {
  amount: number;
  tax_amount: number;
}

export interface Totals {
  lines: LineResult[];
  subtotal: number;
  tax_total: number;
  discount: number;
  adjustment: number;
  total: number;
  taxBreakup: { rate: number; amount: number }[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export function calculateTotals(lines: LineInput[], discount: unknown = 0, adjustment: unknown = 0): Totals {
  let subtotal = 0;
  let taxTotal = 0;
  const breakup = new Map<number, number>();

  const results = lines.map((l) => {
    const qty = num(l.quantity);
    const rate = num(l.rate);
    const disc = Math.min(100, Math.max(0, num(l.discount_percent)));
    const taxRate = Math.max(0, num(l.tax_rate));
    const gross = qty * rate;
    const amount = round2(gross - (gross * disc) / 100);
    const tax = round2((amount * taxRate) / 100);
    subtotal += amount;
    taxTotal += tax;
    if (taxRate > 0) breakup.set(taxRate, round2((breakup.get(taxRate) ?? 0) + tax));
    return { amount, tax_amount: tax };
  });

  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  const d = round2(Math.max(0, num(discount)));
  const adj = round2(num(adjustment));

  return {
    lines: results,
    subtotal,
    tax_total: taxTotal,
    discount: d,
    adjustment: adj,
    total: Math.max(0, round2(subtotal + taxTotal - d + adj)),
    taxBreakup: [...breakup.entries()].sort((a, b) => a[0] - b[0]).map(([rate, amount]) => ({ rate, amount })),
  };
}
