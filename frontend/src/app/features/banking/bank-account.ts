import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { BankTransactions, LedgerEntry, Reconciliation } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { clearedBalance, difference, reconcilable } from './reconcile';

const SOURCE: Record<string, string> = {
  opening: 'Opening balance', payment: 'Payment', expense: 'Expense', journal: 'Journal / transfer',
};

/** One bank or cash account: its transactions with running balance, and statement reconciliation. */
@Component({
  selector: 'app-bank-account',
  imports: [DatePipe, FormsModule, RouterLink, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <a routerLink="/banking" class="btn btn--ghost btn--sm"><app-icon name="chevron-left" [size]="16" /> Banking</a>
      <h1>{{ data()?.account?.name }}</h1>
      <span class="spacer"></span>
      @if (!reconciling() && auth.canDelete()) {
        <button type="button" class="btn btn--sm" (click)="startReconcile()"><app-icon name="check" [size]="16" /> Reconcile</button>
      }
    </div>

    @if (data(); as d) {
      <div class="kpis">
        <div class="card kpi"><div><div class="kpi__label">Balance in books</div><div class="kpi__value">{{ d.closing | money }}</div></div></div>
        <div class="card kpi"><div><div class="kpi__label">Reconciled balance</div><div class="kpi__value">{{ d.cleared_balance | money }}</div></div></div>
        <div class="card kpi"><div><div class="kpi__label">Uncleared transactions</div><div class="kpi__value">{{ unclearedCount() }}</div></div></div>
      </div>

      @if (reconciling()) {
        <div class="card mt-2 rec">
          <div class="rec__inputs">
            <label>Statement end date <input class="input input--sm" type="date" [ngModel]="stDate()" (ngModelChange)="stDate.set($event)" /></label>
            <label>Closing balance on statement <input class="input input--sm" type="number" step="0.01" [ngModel]="stBalance()" (ngModelChange)="stBalance.set($event)" /></label>
            <span class="spacer"></span>
            <button type="button" class="btn btn--ghost btn--sm" (click)="tickAll()">Tick all</button>
            <button type="button" class="btn btn--ghost btn--sm" (click)="cancelReconcile()">Cancel</button>
            <button type="button" class="btn btn--success btn--sm" [disabled]="busy() || diff() !== 0 || !ticked().size" (click)="save()">Save reconciliation</button>
          </div>
          <div class="rec__sum">
            <span>Previously cleared <strong class="mono">{{ d.cleared_balance | money }}</strong></span>
            <span>Ticked ({{ ticked().size }}) <strong class="mono">{{ cleared() - d.cleared_balance | money }}</strong></span>
            <span>Cleared balance <strong class="mono">{{ cleared() | money }}</strong></span>
            <span [class.ok]="diff() === 0" [class.bad]="diff() !== 0">Difference <strong class="mono">{{ diff() | money }}</strong></span>
          </div>
        </div>
      }

      <div class="card mt-2">
        @if (!reconciling()) {
          <div class="tabs">
            <button type="button" [class.active]="!onlyUncleared()" (click)="onlyUncleared.set(false)">All</button>
            <button type="button" [class.active]="onlyUncleared()" (click)="onlyUncleared.set(true)">Uncleared</button>
          </div>
        }
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              @if (reconciling()) { <th style="width:36px"></th> }
              <th>Date</th><th>Transaction</th><th>Details</th><th class="text-right">Deposit</th><th class="text-right">Withdrawal</th>
              @if (!reconciling()) { <th class="text-right">Balance</th><th></th> }
            </tr></thead>
            <tbody>
              @for (r of shown(); track r.key) {
                <tr [class.cleared]="r.reconciliation_id" (click)="reconciling() && toggle(r.key)" [class.pick]="reconciling()">
                  @if (reconciling()) { <td><input type="checkbox" [checked]="ticked().has(r.key)" (click)="$event.stopPropagation()" (change)="toggle(r.key)" [attr.aria-label]="'Tick ' + label(r)" /></td> }
                  <td>{{ r.date ? (r.date | date: 'dd MMM yyyy') : '—' }}</td>
                  <td>@if (link(r); as l) { <a [routerLink]="l" (click)="$event.stopPropagation()">{{ label(r) }}</a> } @else { {{ label(r) }} }</td>
                  <td>{{ r.contact || r.description || '' }}</td>
                  <td class="text-right mono">{{ r.debit ? (r.debit | money) : '' }}</td>
                  <td class="text-right mono">{{ r.credit ? (r.credit | money) : '' }}</td>
                  @if (!reconciling()) {
                    <td class="text-right mono">{{ r.balance | money }}</td>
                    <td>@if (r.reconciliation_id) { <span class="badge" data-tone="success" title="Reconciled">✓ Cleared</span> }</td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="8" class="muted text-center">{{ reconciling() ? 'Nothing left to reconcile up to this date.' : 'No transactions yet.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (history().length) {
        <div class="card mt-2">
          <div class="card__header"><h2>Reconciliation history</h2></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Statement date</th><th class="text-right">Statement balance</th><th class="text-right">Transactions</th><th>By</th><th></th></tr></thead>
              <tbody>
                @for (h of history(); track h.id; let first = $first) {
                  <tr>
                    <td>{{ h.statement_date | date: 'dd MMM yyyy' }}</td>
                    <td class="text-right mono">{{ h.statement_balance | money }}</td>
                    <td class="text-right">{{ h.entries_count }}</td>
                    <td>{{ h.creator?.name || '—' }}</td>
                    <td class="actions">@if (first && auth.canDelete()) { <button type="button" class="btn btn--ghost btn--sm" (click)="undo(h)">Undo</button> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    } @else {
      <div class="loading-bar"></div>
    }
  `,
  styles: `
    .bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
    .bar h1 { font-size: 20px; margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .tabs { display: flex; gap: 4px; padding: 12px 16px 0; }
    .tabs button { border: 0; background: none; padding: 6px 12px; border-radius: 999px; cursor: pointer; color: var(--muted); font: inherit; }
    .tabs button.active { background: var(--primary-50, #eef2ff); color: var(--primary, #4f46e5); font-weight: 600; }
    .rec { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--primary, #4f46e5); }
    .rec__inputs { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
    .rec__inputs label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted); }
    .rec__sum { display: flex; flex-wrap: wrap; gap: 24px; font-size: 13px; color: var(--muted); }
    .rec__sum strong { color: var(--text, #0f172a); margin-left: 4px; }
    .rec__sum .ok strong { color: var(--success); }
    .rec__sum .bad strong { color: var(--danger); }
    tr.cleared td { color: var(--muted); }
    tr.pick { cursor: pointer; }
  `,
})
export class BankAccount implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthStore);

  readonly id = input.required<string>();
  /** ?reconcile=1 opens the reconcile panel straight away (from the Banking list). */
  readonly reconcile = input<string | undefined>();

  protected readonly data = signal<BankTransactions | null>(null);
  protected readonly history = signal<Reconciliation[]>([]);
  protected readonly onlyUncleared = signal(false);
  protected readonly reconciling = signal(false);
  protected readonly busy = signal(false);
  protected readonly stDate = signal(isoDate());
  protected readonly stBalance = signal<number>(0);
  protected readonly ticked = signal<ReadonlySet<string>>(new Set());

  private readonly candidates = computed(() => reconcilable(this.data()?.rows ?? [], this.stDate()));
  protected readonly unclearedCount = computed(() => (this.data()?.rows ?? []).filter((r) => !r.reconciliation_id).length);
  protected readonly shown = computed(() => {
    const rows = this.data()?.rows ?? [];
    if (this.reconciling()) return this.candidates();
    return this.onlyUncleared() ? rows.filter((r) => !r.reconciliation_id) : rows;
  });
  protected readonly cleared = computed(() => clearedBalance(this.data()?.cleared_balance ?? 0, this.candidates(), this.ticked()));
  protected readonly diff = computed(() => difference(this.stBalance(), this.cleared()));

  ngOnInit(): void {
    this.load();
    if (this.reconcile()) this.startReconcile();
  }

  load(): void {
    this.api.get<BankTransactions>(`banking/accounts/${this.id()}/transactions`).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.toast.error(errorMessage(e)),
    });
    this.api.get<Reconciliation[]>(`banking/accounts/${this.id()}/reconciliations`).subscribe((h) => this.history.set(h));
  }

  protected label(r: LedgerEntry): string {
    const l = DOC_CONFIG[r.source as keyof typeof DOC_CONFIG]?.label ?? SOURCE[r.source] ?? r.source;
    return r.number ? `${l} ${r.number}` : l;
  }

  protected link(r: LedgerEntry): string[] | null {
    if (r.source === 'journal') return ['/accounting/journals', String(r.source_id), 'edit'];
    return null;
  }

  startReconcile(): void {
    this.ticked.set(new Set());
    this.stDate.set(isoDate());
    this.stBalance.set(0);
    this.reconciling.set(true);
  }

  cancelReconcile(): void {
    this.reconciling.set(false);
    this.ticked.set(new Set());
  }

  toggle(key: string): void {
    const s = new Set(this.ticked());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.ticked.set(s);
  }

  tickAll(): void {
    this.ticked.set(new Set(this.candidates().map((r) => r.key)));
  }

  save(): void {
    this.busy.set(true);
    const keys = this.candidates().filter((r) => this.ticked().has(r.key)).map((r) => r.key);
    this.api.post(`banking/accounts/${this.id()}/reconcile`, { statement_date: this.stDate(), statement_balance: this.stBalance(), keys }).subscribe({
      next: () => {
        this.busy.set(false);
        this.reconciling.set(false);
        this.toast.success(`${keys.length} transaction(s) reconciled.`);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  async undo(h: Reconciliation): Promise<void> {
    const ok = await this.confirm.ask('Undo reconciliation?', `The ${h.entries_count} transaction(s) cleared on this statement become uncleared again.`, { confirmText: 'Undo' });
    if (!ok) return;
    this.api.delete(`banking/reconciliations/${h.id}`).subscribe({
      next: () => {
        this.toast.success('Reconciliation undone.');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
