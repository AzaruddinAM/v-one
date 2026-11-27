import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { BankAccount } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { LookupsStore } from '../../core/state/lookups.store';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';

/** Banking: cash and bank accounts with balances, adding accounts and moving money between them. */
@Component({
  selector: 'app-banking-list',
  imports: [DatePipe, FormsModule, RouterLink, Icon, Modal, MoneyPipe, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Banking" subtitle="Bank and cash balances, transactions and statement reconciliation.">
      @if (auth.canDelete()) {
        <button type="button" class="btn btn--outline" (click)="openTransfer()" [disabled]="accounts().length < 2"><app-icon name="repeat" /> Transfer money</button>
        <button type="button" class="btn" (click)="adding.set(true)"><app-icon name="plus" /> Add bank account</button>
      }
    </app-page-header>

    @if (loading()) { <div class="loading-bar"></div> }

    <div class="kpis">
      <div class="card kpi"><div><div class="kpi__label">Total in bank</div><div class="kpi__value">{{ totalBank() | money }}</div></div></div>
      <div class="card kpi"><div><div class="kpi__label">Cash in hand</div><div class="kpi__value">{{ totalCash() | money }}</div></div></div>
      <div class="card kpi"><div><div class="kpi__label">Transactions to reconcile</div><div class="kpi__value">{{ uncleared() }}</div></div></div>
    </div>

    <div class="card mt-2">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Account</th><th>Type</th><th>Last reconciled</th><th class="text-right">Uncleared</th><th class="text-right">Balance in books</th><th></th></tr></thead>
          <tbody>
            @for (a of accounts(); track a.id) {
              <tr>
                <td><a [routerLink]="['/banking', a.id]"><strong>{{ a.name }}</strong></a><div class="muted small">{{ a.code }}{{ a.description ? ' · ' + a.description : '' }}</div></td>
                <td><span class="badge">{{ a.sub_type === 'bank' ? 'Bank' : 'Cash' }}</span></td>
                <td>{{ a.last_reconciled ? (a.last_reconciled | date: 'dd MMM yyyy') : 'Never' }}</td>
                <td class="text-right">{{ a.uncleared }}</td>
                <td class="text-right mono" [class.text-danger]="a.balance < 0">{{ a.balance | money }}</td>
                <td class="actions"><a class="btn btn--outline btn--sm" [routerLink]="['/banking', a.id]" [queryParams]="{ reconcile: 1 }">Reconcile</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (adding()) {
      <app-modal title="Add bank account" (closed)="adding.set(false)">
        <form id="bank-form" (ngSubmit)="addAccount()" class="form-grid">
          <div class="field span-all"><label class="req" for="bn">Account name</label><input id="bn" class="input" name="name" [(ngModel)]="newName" placeholder="e.g. Emirates NBD current account" required /></div>
          <div class="field"><label for="bk">Kind</label>
            <select id="bk" class="select" name="kind" [(ngModel)]="newKind"><option value="bank">Bank</option><option value="cash">Cash / petty cash</option></select>
          </div>
          <div class="field"><label for="bo">Opening balance</label><input id="bo" class="input" type="number" step="0.01" name="opening" [(ngModel)]="newOpening" /></div>
          <div class="field span-all"><label for="bd">Account number / note</label><input id="bd" class="input" name="desc" [(ngModel)]="newDesc" placeholder="Last 4 digits, IBAN or branch" /></div>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn--ghost" (click)="adding.set(false)">Cancel</button>
          <button type="submit" form="bank-form" class="btn" [disabled]="busy() || !newName.trim()">Save</button>
        </div>
      </app-modal>
    }

    @if (transferring()) {
      <app-modal title="Transfer money" (closed)="transferring.set(false)">
        <form id="tr-form" (ngSubmit)="transfer()" class="form-grid">
          <div class="field"><label class="req" for="tf">From</label>
            <select id="tf" class="select" name="from" [(ngModel)]="tFrom">@for (a of accounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }</select>
          </div>
          <div class="field"><label class="req" for="tt">To</label>
            <select id="tt" class="select" name="to" [(ngModel)]="tTo">@for (a of accounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }</select>
          </div>
          <div class="field"><label class="req" for="ta">Amount</label><input id="ta" class="input" type="number" min="0.01" step="0.01" name="amt" [(ngModel)]="tAmount" /></div>
          <div class="field"><label class="req" for="td">Date</label><input id="td" class="input" type="date" name="date" [(ngModel)]="tDate" /></div>
          <div class="field span-all"><label for="tr">Reference</label><input id="tr" class="input" name="ref" [(ngModel)]="tRef" placeholder="e.g. Cash deposited at branch" /></div>
        </form>
        <div modal-footer>
          <button type="button" class="btn btn--ghost" (click)="transferring.set(false)">Cancel</button>
          <button type="submit" form="tr-form" class="btn" [disabled]="busy() || !(tAmount > 0) || tFrom === tTo">Transfer</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .small { font-size: 12px; }
  `,
})
export class BankingList implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupsStore);
  protected readonly auth = inject(AuthStore);

  protected readonly accounts = signal<BankAccount[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  protected readonly transferring = signal(false);
  protected readonly totalBank = computed(() => this.sum('bank'));
  protected readonly totalCash = computed(() => this.sum('cash'));
  protected readonly uncleared = computed(() => this.accounts().reduce((s, a) => s + a.uncleared, 0));

  protected newName = '';
  protected newKind: 'bank' | 'cash' = 'bank';
  protected newOpening = 0;
  protected newDesc = '';
  protected tFrom = 0;
  protected tTo = 0;
  protected tAmount = 0;
  protected tDate = isoDate();
  protected tRef = '';

  ngOnInit(): void {
    this.load();
  }

  private sum(kind: 'bank' | 'cash'): number {
    return Math.round(this.accounts().filter((a) => a.sub_type === kind).reduce((s, a) => s + a.balance, 0) * 100) / 100;
  }

  load(): void {
    this.loading.set(true);
    this.api.get<BankAccount[]>('banking/accounts').subscribe({
      next: (a) => {
        this.accounts.set(a);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  /** Next free code in the 1010–1099 range used for bank and cash accounts. */
  private nextCode(): string {
    const used = new Set(this.lookups.accounts().map((a) => a.code));
    let c = 1011;
    while (used.has(String(c))) c++;
    return String(c);
  }

  addAccount(): void {
    this.busy.set(true);
    this.api.post('accounts', {
      code: this.nextCode(), name: this.newName.trim(), type: 'asset', sub_type: this.newKind,
      description: this.newDesc.trim() || null, opening_balance: this.newOpening || 0, is_active: true,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.adding.set(false);
        this.newName = this.newDesc = '';
        this.newOpening = 0;
        this.toast.success('Account added.');
        this.lookups.load({ force: true });
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  openTransfer(): void {
    const a = this.accounts();
    this.tFrom = a.find((x) => x.sub_type === 'cash')?.id ?? a[0].id;
    this.tTo = a.find((x) => x.id !== this.tFrom)?.id ?? a[0].id;
    this.tAmount = 0;
    this.tDate = isoDate();
    this.tRef = '';
    this.transferring.set(true);
  }

  /** A transfer is a two-line journal: Dr the receiving account, Cr the paying account. */
  transfer(): void {
    const note = this.tRef.trim() || 'Transfer';
    this.busy.set(true);
    this.api.post('journals', {
      date: this.tDate, reference: 'Transfer', notes: note,
      lines: [
        { account_id: this.tTo, debit: this.tAmount, credit: 0, description: note },
        { account_id: this.tFrom, debit: 0, credit: this.tAmount, description: note },
      ],
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.transferring.set(false);
        this.toast.success('Transfer recorded.');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
