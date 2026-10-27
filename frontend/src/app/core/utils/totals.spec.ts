import { calculateTotals, round2 } from './totals';

describe('calculateTotals', () => {
  it('computes line amounts, tax and grand total (mirrors backend)', () => {
    const t = calculateTotals([
      { quantity: 2, rate: 100, tax_rate: 18 },
      { quantity: 1, rate: 50, discount_percent: 10, tax_rate: 5 },
    ]);
    expect(t.lines).toEqual([
      { amount: 200, tax_amount: 36 },
      { amount: 45, tax_amount: 2.25 },
    ]);
    expect(t.subtotal).toBe(245);
    expect(t.tax_total).toBe(38.25);
    expect(t.total).toBe(283.25);
  });

  it('applies discount and adjustment', () => {
    expect(calculateTotals([{ quantity: 1, rate: 1000 }], 100, -0.5).total).toBe(899.5);
  });

  it('groups tax by rate for the breakup', () => {
    const t = calculateTotals([
      { quantity: 1, rate: 100, tax_rate: 18 },
      { quantity: 1, rate: 200, tax_rate: 18 },
      { quantity: 1, rate: 100, tax_rate: 5 },
    ]);
    expect(t.taxBreakup).toEqual([
      { rate: 5, amount: 5 },
      { rate: 18, amount: 54 },
    ]);
  });

  it('tolerates empty / string inputs and clamps invalid values', () => {
    const t = calculateTotals([{ quantity: '3', rate: '33.333', tax_rate: '18' }, { quantity: null, rate: undefined }], '', 0);
    expect(t.subtotal).toBe(100);
    expect(t.tax_total).toBe(18);
    expect(calculateTotals([{ quantity: 1, rate: 100, discount_percent: 150 }], 500).total).toBe(0);
  });

  it('round2 avoids floating point drift', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
