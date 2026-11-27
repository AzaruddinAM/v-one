import { describe, expect, it } from 'vitest';
import { LedgerEntry } from '../../core/api/models';
import { clearedBalance, difference, reconcilable } from './reconcile';

const row = (key: string, date: string | null, debit: number, credit: number, rec: number | null = null): LedgerEntry => ({
  key, date, debit, credit, reconciliation_id: rec, account_id: 1, source: 'payment', source_id: 1, number: '', contact_id: null, contact: null, description: null,
});

describe('bank reconciliation', () => {
  const rows = [row('a', '2026-11-01', 600, 0), row('b', '2026-11-05', 0, 150.25), row('c', '2026-11-20', 400, 0), row('d', '2026-10-01', 50, 0, 7)];

  it('offers only uncleared rows up to the statement date', () => {
    expect(reconcilable(rows, '2026-11-10').map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('adds ticked receipts and subtracts ticked payments to the earlier cleared balance', () => {
    expect(clearedBalance(50, rows, new Set(['a', 'b']))).toBe(499.75);
    expect(clearedBalance(50, rows, new Set())).toBe(50);
  });

  it('reports the difference to the statement balance', () => {
    expect(difference(499.75, 499.75)).toBe(0);
    expect(difference(500, 499.75)).toBe(0.25);
  });
});
