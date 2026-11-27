import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ReportLine } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { fiscalYearStart, isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { DOC_CONFIG } from '../../core/documents.config';
import { REPORTS } from './reports.config';

type Row = Record<string, unknown>;
interface Column {
  key: string;
  label: string;
  money?: boolean;
  num?: boolean;
  /** Leave the cell empty instead of showing 0.00 (debit / credit columns). */
  blankZero?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  opening: 'Opening balance', payment: 'Payment', expense: 'Expense', journal: 'Journal',
  invoice: 'Invoice', credit_note: 'Credit note', bill: 'Bill', vendor_credit: 'Vendor credit',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
@Component({
  selector: 'app-report-view',
  imports: [DatePipe, FormsModule, RouterLink, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar no-print">
      <a routerLink="/reports" class="btn btn--ghost btn--sm"><app-icon name="chevron-left" [size]="16" /> Reports</a>
      <span class="spacer"></span>
      @if (def()?.period === 'range') {
        <select class="select input--sm" style="width:auto" [ngModel]="preset()" (ngModelChange)="applyPreset($event)">
          <option value="fy">This financial year</option>
          <option value="month">This month</option>
          <option value="last-month">Last month</option>
          <option value="quarter">Last 3 months</option>
          <option value="cal-quarter">Last calendar quarter</option>
          <option value="custom">Custom</option>
        </select>
        <input class="input input--sm" type="date" style="width:auto" [ngModel]="from()" (ngModelChange)="from.set($event); preset.set('custom')" />
        <input class="input input--sm" type="date" style="width:auto" [ngModel]="to()" (ngModelChange)="to.set($event); preset.set('custom')" />
      }
      @if (def()?.period === 'asOf') {
        <label class="muted">As of</label>
        <input class="input input--sm" type="date" style="width:auto" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      }
      <button type="button" class="btn btn--outline btn--sm" (click)="exportCsv()" [disabled]="!data()"><app-icon name="invoice" [size]="16" /> CSV</button>
      <button type="button" class="btn btn--outline btn--sm" (click)="print()"><app-icon name="print" [size]="16" /> Print</button>
    </div>

    <article class="card report">
      <header class="report__head">
        <div class="muted">{{ auth.organization()?.name }}</div>
        <h1>{{ def()?.title }}</h1>
        <div class="muted">{{ periodLabel() }}</div>
      </header>
      @if (loading()) { <div class="loading-bar"></div> }
      @if (error(); as e) { <div class="alert">{{ e }}</div> }

      @if (data(); as d) {
        @switch (report()) {
          @case ('profit-loss') {
            <div class="table-wrap">
              <table class="table statement">
                <tbody>
                  <tr class="section"><td colspan="2">Income</td></tr>
                  @for (l of d.income; track $index) { <tr><td class="indent">{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td></tr> }
                  <tr class="subtotal"><td>Total income</td><td class="text-right mono">{{ d.total_income | money }}</td></tr>
                  <tr class="section"><td colspan="2">Expenses</td></tr>
                  @for (l of d.expenses; track $index) { <tr><td class="indent">{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td></tr> }
                  <tr class="subtotal"><td>Total expenses</td><td class="text-right mono">{{ d.total_expenses | money }}</td></tr>
                </tbody>
                <tfoot>
                  <tr class="grand" [class.loss]="d.net_profit < 0"><td>Net {{ d.net_profit < 0 ? 'loss' : 'profit' }}</td><td class="text-right mono">{{ d.net_profit | money }}</td></tr>
                </tfoot>
              </table>
            </div>
          }
          @case ('balance-sheet') {
            <div class="table-wrap">
              <table class="table statement">
                <tbody>
                  <tr class="section"><td colspan="2">Assets</td></tr>
                  @for (l of d.assets; track $index) { <tr><td class="indent">{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td></tr> }
                  <tr class="subtotal"><td>Total assets</td><td class="text-right mono">{{ d.total_assets | money }}</td></tr>
                  <tr class="section"><td colspan="2">Liabilities</td></tr>
                  @for (l of d.liabilities; track $index) { <tr><td class="indent">{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td></tr> }
                  <tr class="subtotal"><td>Total liabilities</td><td class="text-right mono">{{ d.total_liabilities | money }}</td></tr>
                  <tr class="section"><td colspan="2">Equity</td></tr>
                  @for (l of d.equity; track $index) { <tr><td class="indent">{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td></tr> }
                  <tr class="subtotal"><td>Total equity</td><td class="text-right mono">{{ d.total_equity | money }}</td></tr>
                </tbody>
                <tfoot><tr class="grand"><td>Liabilities + Equity</td><td class="text-right mono">{{ d.total_liabilities + d.total_equity | money }}</td></tr></tfoot>
              </table>
            </div>
          }
          @case ('vat-return') {
            <div class="kpis tax">
              <div class="card kpi"><div><div class="kpi__label">Output VAT (box 8)</div><div class="kpi__value">{{ d.output_vat | money }}</div></div></div>
              <div class="card kpi"><div><div class="kpi__label">Recoverable VAT (box 12)</div><div class="kpi__value">{{ d.input_vat | money }}</div></div></div>
              <div class="card kpi"><div><div class="kpi__label">{{ d.net_vat < 0 ? 'Refundable VAT' : 'Net VAT due' }} (box 14)</div><div class="kpi__value" [class.text-danger]="d.net_vat > 0">{{ d.net_vat | money }}</div></div></div>
            </div>
            <div class="tax-tables">
              <div class="table-wrap">
                <table class="table statement">
                  <thead><tr><th style="width:60px">Box</th><th>VAT on sales and all other outputs</th><th class="text-right">Amount</th><th class="text-right">VAT</th></tr></thead>
                  <tbody>
                    @for (l of d.supplies; track l.box) { <tr><td>{{ l.box }}</td><td>{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td><td class="text-right mono">{{ l.vat | money }}</td></tr> }
                    <tr class="subtotal"><td>8</td><td>Totals</td><td class="text-right mono">{{ d.supplies_total.amount | money }}</td><td class="text-right mono">{{ d.supplies_total.vat | money }}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="table-wrap">
                <table class="table statement mt-2">
                  <thead><tr><th style="width:60px">Box</th><th>VAT on expenses and all other inputs</th><th class="text-right">Amount</th><th class="text-right">Recoverable VAT</th></tr></thead>
                  <tbody>
                    @for (l of d.expenses; track l.box) { <tr><td>{{ l.box }}</td><td>{{ l.name }}</td><td class="text-right mono">{{ l.amount | money }}</td><td class="text-right mono">{{ l.vat | money }}</td></tr> }
                    <tr class="subtotal"><td>12</td><td>Totals</td><td class="text-right mono">{{ d.expenses_total.amount | money }}</td><td class="text-right mono">{{ d.expenses_total.vat | money }}</td></tr>
                  </tbody>
                  <tfoot><tr class="grand" [class.loss]="d.net_vat < 0"><td>14</td><td>Payable tax for the period</td><td></td><td class="text-right mono">{{ d.net_vat | money }}</td></tr></tfoot>
                </table>
              </div>
              <p class="muted small mt-1">
                Supplies are classified by the VAT rate on each invoice line: 5% = standard rated, 0% = zero rated, tax type EXEMPT = exempt.
                Credit notes and vendor credits are deducted in the period they are dated.
                @if (d.out_of_scope.amount) { Lines with no tax selected ({{ d.out_of_scope.amount | money }}) are left out as out of scope. }
                Box 1 is not split by Emirate here; reverse-charge, tourist refunds and box 2/3/6/7/10/11 adjustments are entered on the FTA portal directly.
              </p>
            </div>
          }
          @case ('tax-summary') {
            <div class="kpis tax">
              <div class="card kpi"><div><div class="kpi__label">Output tax (sales)</div><div class="kpi__value">{{ d.output_total | money }}</div></div></div>
              <div class="card kpi"><div><div class="kpi__label">Input tax credit</div><div class="kpi__value">{{ d.input_total | money }}</div></div></div>
              <div class="card kpi"><div><div class="kpi__label">Net tax payable</div><div class="kpi__value" [class.text-danger]="d.net_payable > 0">{{ d.net_payable | money }}</div></div></div>
            </div>
            <div class="grid-2 tax-tables">
              @for (blk of [{ t: 'Output tax (invoices)', rows: d.output }, { t: 'Input tax (bills)', rows: d.input }]; track blk.t) {
                <div>
                  <h3>{{ blk.t }}</h3>
                  <div class="table-wrap">
                    <table class="table">
                      <thead><tr><th>Rate</th><th class="text-right">Taxable value</th><th class="text-right">Tax</th></tr></thead>
                      <tbody>
                        @for (r of blk.rows; track $index) { <tr><td>{{ r.rate }}%</td><td class="text-right mono">{{ r.taxable | money }}</td><td class="text-right mono">{{ r.tax | money }}</td></tr> }
                        @empty { <tr><td colspan="3" class="muted">No data</td></tr> }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
            @if (d.expense_tax) { <p class="muted mt-1">Includes {{ d.expense_tax | money }} tax paid on expenses in input credit.</p> }
          }
          @case ('general-ledger') {
            <div class="gl-filter no-print">
              <select class="select input--sm" [ngModel]="glAccount()" (ngModelChange)="glAccount.set($event)">
                <option [ngValue]="0">All accounts</option>
                @for (a of d.accounts; track a.account_id) { <option [ngValue]="a.account_id">{{ a.code }} · {{ a.name }}</option> }
              </select>
            </div>
            @for (a of glAccounts(); track a.account_id) {
              <div class="table-wrap">
                <table class="table statement gl">
                  <thead>
                    <tr class="section"><td colspan="6">{{ a.code }} · {{ a.name }}</td></tr>
                    <tr><th>Date</th><th>Transaction</th><th>Details</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr>
                  </thead>
                  <tbody>
                    <tr class="muted"><td colspan="5">Opening balance</td><td class="text-right mono">{{ dc(a.opening) }}</td></tr>
                    @for (r of a.rows; track $index) {
                      <tr>
                        <td class="nowrap">{{ r.date | date: 'dd MMM yyyy' }}</td>
                        <td>@if (srcLink(r); as l) { <a [routerLink]="l">{{ srcLabel(r) }}</a> } @else { {{ srcLabel(r) }} }</td>
                        <td>{{ r.contact || r.description || '' }}</td>
                        <td class="text-right mono">{{ r.debit ? (r.debit | money) : '' }}</td>
                        <td class="text-right mono">{{ r.credit ? (r.credit | money) : '' }}</td>
                        <td class="text-right mono">{{ dc(r.balance) }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot><tr class="subtotal"><td colspan="3">Closing balance</td><td class="text-right mono">{{ a.debit | money }}</td><td class="text-right mono">{{ a.credit | money }}</td><td class="text-right mono">{{ dc(a.closing) }}</td></tr></tfoot>
                </table>
              </div>
            } @empty { <p class="muted text-center">No postings for this period.</p> }
          }
          @case ('day-book') {
            <div class="table-wrap">
              <table class="table statement">
                <thead><tr><th>Date</th><th>Transaction</th><th>Account</th><th class="text-right">Debit</th><th class="text-right">Credit</th></tr></thead>
                @for (t of d.transactions; track $index) {
                  <tbody class="tx">
                    @for (l of t.lines; track $index; let first = $first) {
                      <tr>
                        <td class="nowrap">{{ first ? (t.date | date: 'dd MMM yyyy') : '' }}</td>
                        <td>
                          @if (first) {
                            @if (srcLink(t); as lk) { <a [routerLink]="lk">{{ srcLabel(t) }}</a> } @else { {{ srcLabel(t) }} }
                            @if (t.contact) { <div class="muted small">{{ t.contact }}</div> }
                          }
                        </td>
                        <td [class.indent]="!l.debit">{{ l.account }}</td>
                        <td class="text-right mono">{{ l.debit ? (l.debit | money) : '' }}</td>
                        <td class="text-right mono">{{ l.credit ? (l.credit | money) : '' }}</td>
                      </tr>
                    }
                  </tbody>
                } @empty { <tbody><tr><td colspan="5" class="muted text-center">No transactions for this period.</td></tr></tbody> }
                @if (d.transactions.length) {
                  <tfoot><tr class="subtotal"><td colspan="3">{{ d.transactions.length }} transactions</td><td class="text-right mono">{{ d.total | money }}</td><td class="text-right mono">{{ d.total | money }}</td></tr></tfoot>
                }
              </table>
            </div>
          }
          @default {
            <div class="table-wrap">
              <table class="table">
                <thead><tr>@for (c of columns(); track c.key) { <th [class.text-right]="c.money || c.num">{{ c.label }}</th> }</tr></thead>
                <tbody>
                  @for (r of rows(); track $index) {
                    <tr>
                      @for (c of columns(); track c.key) {
                        <td [class.text-right]="c.money || c.num" [class.mono]="c.money || c.num" [class.text-danger]="c.key === 'name' && r['low']">
                          {{ c.money ? (c.blankZero && !asNum(r[c.key]) ? '' : (asNum(r[c.key]) | money)) : r[c.key] }}
                        </td>
                      }
                    </tr>
                  } @empty {
                    <tr><td [attr.colspan]="columns().length" class="muted text-center">No data for this period.</td></tr>
                  }
                </tbody>
                @if (footer(); as f) {
                  <tfoot><tr>@for (c of columns(); track c.key) { <td [class.text-right]="c.money || c.num" class="mono">{{ c.money && f[c.key] !== undefined ? (asNum(f[c.key]) | money) : (f[c.key] ?? '') }}</td> }</tr></tfoot>
                }
              </table>
            </div>
          }
        }
      }
    </article>
  `,
  styles: `
    .bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .report { max-width: 1000px; margin: 0 auto; padding-bottom: 12px; }
    .report__head { text-align: center; padding: 28px 20px 20px; }
    .report__head h1 { margin: 4px 0; }
    .statement td { border-bottom: 1px solid #f1f3f8; }
    .statement .section td { font-weight: 700; background: var(--surface-2); text-transform: uppercase; font-size: 12px; letter-spacing: .05em; color: var(--muted); }
    .statement .indent { padding-left: 32px; }
    .statement .subtotal td { font-weight: 650; border-top: 1px solid var(--border); }
    .statement .grand td { font-size: 16px; font-weight: 750; color: var(--success); background: var(--success-50); }
    .statement .grand.loss td { color: var(--danger); background: var(--danger-50); }
    .tax { padding: 0 20px; }
    .tax-tables { padding: 20px; }
    .tax-tables h3 { margin-bottom: 8px; }
    .gl-filter { padding: 0 20px 12px; display: flex; justify-content: flex-end; }
    .gl-filter .select { width: auto; }
    .gl { margin-bottom: 18px; }
    .tx tr:last-child td { border-bottom: 1px solid var(--border); }
    .small { font-size: 12px; }
    .nowrap { white-space: nowrap; }
  `,
})
export class ReportView {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthStore);

  readonly report = input.required<string>();
  protected readonly def = computed(() => REPORTS.find((r) => r.key === this.report()));
  protected readonly from = signal(fiscalYearStart(this.auth.organization()?.fiscal_year_start ?? 4));
  protected readonly to = signal(isoDate());
  protected readonly preset = signal('fy');
  protected readonly data = signal<any>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly periodLabel = computed(() => {
    const p = this.def()?.period;
    const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (p === 'range') return `${fmt(this.from())} – ${fmt(this.to())}`;
    if (p === 'asOf') return `As of ${fmt(this.to())}`;
    return `As of ${fmt(isoDate())}`;
  });

  protected readonly columns = computed<Column[]>(() => {
    switch (this.report()) {
      case 'receivables':
      case 'payables':
        return [
          { key: 'name', label: this.report() === 'receivables' ? 'Customer' : 'Vendor' },
          { key: 'current', label: 'Current', money: true },
          { key: '1_15', label: '1–15 days', money: true },
          { key: '16_30', label: '16–30 days', money: true },
          { key: '31_45', label: '31–45 days', money: true },
          { key: 'over_45', label: '> 45 days', money: true },
          { key: 'total', label: 'Total', money: true },
        ];
      case 'sales-by-customer':
        return [
          { key: 'name', label: 'Customer' },
          { key: 'invoices', label: 'Invoices', num: true },
          { key: 'sales', label: 'Sales (excl. tax)', money: true },
          { key: 'total', label: 'Sales (incl. tax)', money: true },
        ];
      case 'sales-by-item':
        return [
          { key: 'name', label: 'Item' },
          { key: 'quantity', label: 'Qty sold', num: true },
          { key: 'average_price', label: 'Avg price', money: true },
          { key: 'amount', label: 'Amount', money: true },
        ];
      case 'trial-balance':
        return [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Account' },
          { key: 'type', label: 'Type' },
          { key: 'debit', label: 'Debit', money: true, blankZero: true },
          { key: 'credit', label: 'Credit', money: true, blankZero: true },
        ];
      case 'customer-balances':
      case 'vendor-balances': {
        const customer = this.report() === 'customer-balances';
        return [
          { key: 'name', label: customer ? 'Customer' : 'Vendor' },
          { key: 'billed', label: customer ? 'Invoiced' : 'Billed', money: true },
          { key: 'paid', label: customer ? 'Received & credited' : 'Paid & credited', money: true },
          ...(customer ? [{ key: 'advance', label: 'Unused advance', money: true, blankZero: true }] : []),
          { key: 'balance', label: 'Balance due', money: true },
        ];
      }
      case 'inventory':
        return [
          { key: 'name', label: 'Item' },
          { key: 'sku', label: 'SKU' },
          { key: 'stock_on_hand', label: 'Stock', num: true },
          { key: 'purchase_price', label: 'Cost', money: true },
          { key: 'value', label: 'Value', money: true },
        ];
      default:
        return [];
    }
  });

  protected readonly rows = computed<Row[]>(() => {
    const d = this.data();
    if (!d) return [];
    return Array.isArray(d) ? d : (d.rows ?? []);
  });

  protected readonly footer = computed<Row | null>(() => {
    const d = this.data();
    const r = this.rows();
    if (!d || !r.length) return null;
    switch (this.report()) {
      case 'receivables':
      case 'payables':
        return { name: 'Total', ...d.totals };
      case 'inventory':
        return { name: 'Total', value: d.total_value };
      case 'sales-by-customer':
        return { name: 'Total', sales: this.sum(r, 'sales'), total: this.sum(r, 'total'), invoices: this.sum(r, 'invoices') };
      case 'sales-by-item':
        return { name: 'Total', amount: this.sum(r, 'amount') };
      case 'trial-balance':
        return { name: 'Total', debit: d.total_debit, credit: d.total_credit };
      case 'customer-balances':
      case 'vendor-balances':
        return { name: 'Total', billed: this.sum(r, 'billed'), paid: this.sum(r, 'paid'), advance: d.total_advance, balance: d.total };
      default:
        return null;
    }
  });

  constructor() {
    effect(() => {
      const report = this.report();
      const from = this.from();
      const to = this.to();
      untracked(() => this.fetch(report, from, to));
    });
  }

  private fetch(report: string, from: string, to: string): void {
    const def = REPORTS.find((r) => r.key === report);
    if (!def) return;
    const params = def.period === 'range' ? { from, to } : def.period === 'asOf' ? { as_of: to } : {};
    this.loading.set(true);
    this.error.set(null);
    this.api.get<unknown>(`reports/${report}`, params).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  applyPreset(p: string): void {
    this.preset.set(p);
    const now = new Date();
    if (p === 'fy') {
      this.from.set(fiscalYearStart(this.auth.organization()?.fiscal_year_start ?? 4));
      this.to.set(isoDate());
    } else if (p === 'month') {
      this.from.set(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      this.to.set(isoDate());
    } else if (p === 'last-month') {
      this.from.set(isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      this.to.set(isoDate(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (p === 'cal-quarter') {
      const q = Math.floor(now.getMonth() / 3);
      this.from.set(isoDate(new Date(now.getFullYear(), (q - 1) * 3, 1)));
      this.to.set(isoDate(new Date(now.getFullYear(), q * 3, 0)));
    } else if (p === 'quarter') {
      this.from.set(isoDate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())));
      this.to.set(isoDate());
    }
  }

  /** General ledger account filter (0 = all). */
  protected readonly glAccount = signal(0);
  protected readonly glAccounts = computed<any[]>(() => {
    const all = this.data()?.accounts ?? [];
    return this.glAccount() ? all.filter((a: any) => a.account_id === this.glAccount()) : all;
  });

  protected srcLabel(e: { source: string; number?: string }): string {
    const label = SOURCE_LABEL[e.source] ?? e.source;
    return e.number ? `${label} ${e.number}` : label;
  }

  protected srcLink(e: { source: string; source_id: number }): string[] | null {
    const cfg = DOC_CONFIG[e.source as keyof typeof DOC_CONFIG];
    if (cfg) return [cfg.path, String(e.source_id)];
    if (e.source === 'journal') return ['/accounting/journals', String(e.source_id), 'edit'];
    return null;
  }

  /** Balance with Dr / Cr suffix, as accountants read it. */
  protected dc(v: number): string {
    if (Math.abs(v) < 0.005) return '0.00';
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${s} ${v > 0 ? 'Dr' : 'Cr'}`;
  }

  protected asNum(v: unknown): number {
    return Number(v) || 0;
  }

  private sum(rows: Row[], key: string): number {
    return Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;
  }

  exportCsv(): void {
    const d = this.data();
    if (!d) return;
    let lines: (string | number)[][] = [];
    const statement = (sections: [string, ReportLine[], number][]) =>
      sections.flatMap(([title, items, total]) => [[title, ''], ...items.map((l) => [l.name, l.amount]), [`Total ${title.toLowerCase()}`, total]]);
    if (this.report() === 'profit-loss') {
      lines = [...statement([['Income', d.income, d.total_income], ['Expenses', d.expenses, d.total_expenses]]), ['Net profit', d.net_profit]];
    } else if (this.report() === 'balance-sheet') {
      lines = statement([['Assets', d.assets, d.total_assets], ['Liabilities', d.liabilities, d.total_liabilities], ['Equity', d.equity, d.total_equity]]);
    } else if (this.report() === 'vat-return') {
      lines = [
        ['Box', 'Description', 'Amount', 'VAT'],
        ...d.supplies.map((l: any) => [l.box, l.name, l.amount, l.vat]),
        ['8', 'Totals', d.supplies_total.amount, d.supplies_total.vat],
        ...d.expenses.map((l: any) => [l.box, l.name, l.amount, l.vat]),
        ['12', 'Totals', d.expenses_total.amount, d.expenses_total.vat],
        ['14', 'Payable tax for the period', '', d.net_vat],
      ];
    } else if (this.report() === 'general-ledger') {
      lines = [['Account', 'Date', 'Transaction', 'Details', 'Debit', 'Credit', 'Balance']];
      for (const a of this.glAccounts()) {
        lines.push([`${a.code} ${a.name}`, '', 'Opening balance', '', '', '', a.opening]);
        for (const r of a.rows) lines.push([`${a.code} ${a.name}`, r.date, this.srcLabel(r), r.contact || r.description || '', r.debit, r.credit, r.balance]);
        lines.push([`${a.code} ${a.name}`, '', 'Closing balance', '', a.debit, a.credit, a.closing]);
      }
    } else if (this.report() === 'day-book') {
      lines = [['Date', 'Transaction', 'Contact', 'Account', 'Debit', 'Credit']];
      for (const t of d.transactions) for (const l of t.lines) lines.push([t.date, this.srcLabel(t), t.contact || '', l.account, l.debit, l.credit]);
    } else if (this.report() === 'tax-summary') {
      lines = [['Type', 'Rate', 'Taxable', 'Tax'], ...d.output.map((r: any) => ['Output', r.rate, r.taxable, r.tax]), ...d.input.map((r: any) => ['Input', r.rate, r.taxable, r.tax]), ['Net payable', '', '', d.net_payable]];
    } else {
      const cols = this.columns();
      lines = [cols.map((c) => c.label), ...this.rows().map((r) => cols.map((c) => String(r[c.key] ?? '')))];
      const f = this.footer();
      if (f) lines.push(cols.map((c) => String(f[c.key] ?? '')));
    }
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${this.report()}-${isoDate()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  print(): void {
    window.print();
  }
}
