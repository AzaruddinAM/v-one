import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ContactDetail, ContactType } from '../../core/api/models';
import { DOC_CONFIG, docPath } from '../../core/documents.config';
import { fiscalYearStart, isoDate } from '../../core/utils/dates';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';

interface Statement {
  opening_balance: number;
  closing_balance: number;
  rows: { date: string; type: string; number: string; debit: number; credit: number; balance: number }[];
}

@Component({
  selector: 'app-contact-view',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (contact(); as c) {
      <app-page-header [title]="c.name" [subtitle]="c.company_name ?? ''">
        <a [routerLink]="[base(), c.id, 'edit']" class="btn btn--outline"><app-icon name="edit" /> Edit</a>
        <a [routerLink]="newDocLink()" [queryParams]="{ contact: c.id }" class="btn"><app-icon name="plus" /> New {{ isCustomer() ? 'Invoice' : 'Bill' }}</a>
      </app-page-header>

      <section class="kpis">
        <div class="card kpi"><div><div class="kpi__label">Outstanding</div><div class="kpi__value">{{ c.summary.outstanding | money }}</div></div></div>
        <div class="card kpi"><div><div class="kpi__label">Total {{ isCustomer() ? 'invoiced' : 'billed' }}</div><div class="kpi__value">{{ c.summary.total_billed | money }}</div></div></div>
        <div class="card kpi"><div><div class="kpi__label">Total paid</div><div class="kpi__value">{{ c.summary.total_paid | money }}</div></div></div>
      </section>

      <section class="grid-3 mt-2">
        <div class="card">
          <div class="card__header">
            <h2>{{ tab() === 'docs' ? 'Recent transactions' : 'Statement (this financial year)' }}</h2>
            <div class="segmented">
              <button type="button" [class.is-active]="tab() === 'docs'" (click)="tab.set('docs')">Transactions</button>
              <button type="button" [class.is-active]="tab() === 'statement'" (click)="showStatement()">Statement</button>
            </div>
          </div>
          <div class="table-wrap">
            @if (tab() === 'docs') {
              <table class="table">
                <thead><tr><th>Type</th><th>Number</th><th>Date</th><th>Status</th><th class="text-right">Total</th><th class="text-right">Balance</th></tr></thead>
                <tbody>
                  @for (d of c.recent_documents; track d.id) {
                    <tr class="is-clickable" [routerLink]="link(d.type, d.id)">
                      <td><span class="chip">{{ label(d.type) }}</span></td>
                      <td>{{ d.number }}</td>
                      <td>{{ d.date | date: 'dd MMM yyyy' }}</td>
                      <td><app-status-badge [status]="d.status" /></td>
                      <td class="text-right mono">{{ d.total | money }}</td>
                      <td class="text-right mono">{{ d.balance | money }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="muted text-center">No transactions yet.</td></tr>
                  }
                </tbody>
              </table>
            } @else if (statement(); as s) {
              <table class="table">
                <thead><tr><th>Date</th><th>Transaction</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr></thead>
                <tbody>
                  <tr><td></td><td class="muted">Opening balance</td><td></td><td></td><td class="text-right mono">{{ s.opening_balance | money }}</td></tr>
                  @for (r of s.rows; track $index) {
                    <tr>
                      <td class="nowrap">{{ r.date | date: 'dd MMM yyyy' }}</td>
                      <td><span class="chip">{{ r.type.replace('_', ' ') }}</span> {{ r.number }}</td>
                      <td class="text-right mono">{{ r.debit ? (r.debit | money) : '' }}</td>
                      <td class="text-right mono">{{ r.credit ? (r.credit | money) : '' }}</td>
                      <td class="text-right mono">{{ r.balance | money }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot><tr><td colspan="4">Closing balance</td><td class="text-right mono">{{ s.closing_balance | money }}</td></tr></tfoot>
              </table>
            } @else {
              <div class="loading-bar"></div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h2>Details</h2></div>
          <dl class="dl card__body">
            <dt>Phone</dt><dd>{{ c.phone || '—' }}</dd>
            <dt>Email</dt><dd>{{ c.email || '—' }}</dd>
            <dt>GSTIN</dt><dd>{{ c.gstin || '—' }}</dd>
            <dt>PAN</dt><dd>{{ c.pan || '—' }}</dd>
            <dt>Payment terms</dt><dd>Net {{ c.payment_terms }} days</dd>
            <dt>Billing address</dt><dd style="white-space:pre-line">{{ c.billing_address || '—' }}<br />{{ cityLine(c) }}</dd>
            <dt>Notes</dt><dd>{{ c.notes || '—' }}</dd>
          </dl>
        </div>
      </section>
    } @else {
      <div class="loading-bar"></div>
    }
  `,
})
export class ContactView implements OnInit {
  private readonly api = inject(ApiService);
  readonly id = input.required<string>();
  readonly contactType = input<ContactType>('customer');

  protected readonly contact = signal<ContactDetail | null>(null);
  protected readonly statement = signal<Statement | null>(null);
  protected readonly tab = signal<'docs' | 'statement'>('docs');
  protected readonly isCustomer = computed(() => this.contactType() === 'customer');
  protected readonly base = computed(() => (this.isCustomer() ? '/customers' : '/vendors'));
  protected readonly newDocLink = computed(() => (this.isCustomer() ? '/sales/invoices/new' : '/purchases/bills/new'));
  protected readonly link = docPath;
  protected readonly label = (t: keyof typeof DOC_CONFIG) => DOC_CONFIG[t].label;
  protected readonly cityLine = (c: ContactDetail) => [c.city, c.state, c.pincode].filter((v) => !!v).join(', ');

  ngOnInit(): void {
    this.api.get<ContactDetail>(`contacts/${this.id()}`).subscribe((c) => this.contact.set(c));
  }

  showStatement(): void {
    this.tab.set('statement');
    if (!this.statement()) {
      this.api
        .get<Statement>(`contacts/${this.id()}/statement`, { from: fiscalYearStart(), to: isoDate() })
        .subscribe((s) => this.statement.set(s));
    }
  }
}
