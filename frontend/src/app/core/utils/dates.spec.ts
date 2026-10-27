import { addDays, fiscalYearStart, isoDate } from './dates';

describe('date utils', () => {
  it('formats local dates as yyyy-MM-dd', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
  });

  it('computes the financial year start (April by default)', () => {
    expect(fiscalYearStart(4, new Date(2026, 9, 27))).toBe('2026-04-01');
    expect(fiscalYearStart(4, new Date(2026, 1, 10))).toBe('2025-04-01');
    expect(fiscalYearStart(1, new Date(2026, 1, 10))).toBe('2026-01-01');
  });
});
