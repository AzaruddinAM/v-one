import { formatMoney } from './money.pipe';

describe('formatMoney', () => {
  it('uses Indian digit grouping and currency symbol', () => {
    expect(formatMoney(123456.5)).toBe('₹1,23,456.50');
  });

  it('can omit the symbol and handles strings / null', () => {
    expect(formatMoney('2500', 'INR', false)).toBe('2,500.00');
    expect(formatMoney(null)).toBe('₹0.00');
  });

  it('supports other currencies', () => {
    expect(formatMoney(10, 'USD')).toContain('10.00');
  });
});
