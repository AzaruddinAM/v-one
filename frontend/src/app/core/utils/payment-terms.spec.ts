import { dueDateFor, termsForDays } from './payment-terms';

describe('payment terms', () => {
  it('adds net days', () => {
    expect(dueDateFor('Net 15', '2026-11-10')).toBe('2026-11-25');
    expect(dueDateFor('Due on receipt', '2026-11-10')).toBe('2026-11-10');
  });
  it('handles end of month rules', () => {
    expect(dueDateFor('Due end of the month', '2026-02-10')).toBe('2026-02-28');
    expect(dueDateFor('Due end of next month', '2026-11-10')).toBe('2026-12-31');
    expect(dueDateFor('Due end of next month', '2026-12-31')).toBe('2027-01-31');
  });
  it('returns null for custom terms and maps contact days', () => {
    expect(dueDateFor('', '2026-11-10')).toBeNull();
    expect(termsForDays(30)).toBe('Net 30');
    expect(termsForDays(0)).toBe('Due on receipt');
    expect(termsForDays(21)).toBe('');
  });
});
