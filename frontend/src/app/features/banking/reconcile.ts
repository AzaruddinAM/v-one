import { LedgerEntry } from '../../core/api/models';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rows that can be ticked against a statement: not yet reconciled, dated on or before the statement date. */
export function reconcilable(rows: LedgerEntry[], statementDate: string): LedgerEntry[] {
  return rows.filter((r) => !r.reconciliation_id && (r.date === null || r.date <= statementDate));
}

/** Balance the bank will agree with once the ticked rows clear: earlier cleared balance plus their net amount. */
export function clearedBalance(previous: number, rows: LedgerEntry[], ticked: ReadonlySet<string>): number {
  return round2(rows.reduce((s, r) => (ticked.has(r.key) ? s + r.debit - r.credit : s), previous));
}

/** Statement balance minus cleared balance; the reconciliation can be saved only at 0. */
export function difference(statementBalance: number, cleared: number): number {
  return round2((Number(statementBalance) || 0) - cleared);
}
