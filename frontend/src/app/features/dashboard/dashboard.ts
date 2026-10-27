import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { docPath } from '../../core/documents.config';
import { BarChart } from '../../shared/bar-chart';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';
import { DashboardStore } from './dashboard.store';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, StatusBadge, BarChart],
  providers: [DashboardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.scss',
  template: `
    <app-page-header [title]="greeting() + ', ' + firstName()" subtitle="Here's what's happening with your business today.">
      <button type="button" class="btn btn--outline" (click)="store.load()" [disabled]="store.loading()"><app-icon name="refresh" /> Refresh</button>
      <a routerLink="/sales/invoices/new" class="btn"><app-icon name="plus" /> New Invoice</a>
    </app-page-header>

    @if (store.error(); as e) {
      <div class="alert mt-1"><app-icon name="alert" /> {{ e }}</div>
    }

    @if (store.data(); as d) {
      <section class="kpis">
        <div class="card kpi">
          <div class="kpi__icon"><app-icon name="trending-up" /></div>
          <div>
            <div class="kpi__label">Total Receivables</div>
            <div class="kpi__value">{{ d.receivable | money }}</div>
            <div class="kpi__sub"><span class="text-danger">{{ d.overdue_receivable | money }}</span> overdue</div>
          </div>
        </div>
        <div class="card kpi">
          <div class="kpi__icon" data-tone="warning"><app-icon name="trending-down" /></div>
          <div>
            <div class="kpi__label">Total Payables</div>
            <div class="kpi__value">{{ d.payable | money }}</div>
            <div class="kpi__sub"><span class="text-danger">{{ d.overdue_payable | money }}</span> overdue</div>
          </div>
        </div>
        <div class="card kpi">
          <div class="kpi__icon" data-tone="success"><app-icon name="invoice" /></div>
          <div>
            <div class="kpi__label">Sales this month</div>
            <div class="kpi__value">{{ d.sales_this_month | money }}</div>
            <div class="kpi__sub">{{ d.received_this_month | money }} received</div>
          </div>
        </div>
        <div class="card kpi">
          <div class="kpi__icon" data-tone="danger"><app-icon name="wallet" /></div>
          <div>
            <div class="kpi__label">Expenses this month</div>
            <div class="kpi__value">{{ d.expenses_this_month | money }}</div>
            <div class="kpi__sub">Bills + expenses</div>
          </div>
        </div>
      </section>

      <section class="grid-3 mt-2">
        <div class="card">
          <div class="card__header">
            <div>
              <h2>Sales vs Expenses</h2>
              <p class="muted">Last 12 months</p>
            </div>
            <div class="totals">
              <div><small class="muted">Sales</small><strong>{{ store.yearSales() | money }}</strong></div>
              <div><small class="muted">Expenses</small><strong>{{ store.yearExpenses() | money }}</strong></div>
            </div>
          </div>
          <div class="card__body">
            <app-bar-chart
              [labels]="store.labels()"
              [currency]="auth.currency()"
              [series]="[
                { label: 'Sales', values: store.sales(), color: '#6366f1' },
                { label: 'Expenses', values: store.expenses(), color: '#f59e0b' }
              ]"
            />
          </div>
        </div>

        <div class="card">
          <div class="card__header"><h2>Top customers</h2></div>
          @for (c of d.top_customers; track c.id) {
            <a class="list-row top" [routerLink]="['/customers', c.id]">
              <div class="avatar">{{ c.name.charAt(0) }}</div>
              <div class="top__body">
                <div class="gap"><strong>{{ c.name }}</strong><span class="spacer"></span><span class="mono">{{ c.total | money }}</span></div>
                <div class="bar"><span [style.width.%]="(c.total / store.topMax()) * 100"></span></div>
              </div>
            </a>
          } @empty {
            <p class="muted card__body">No sales yet.</p>
          }
        </div>
      </section>

      <section class="grid-3 mt-2">
        <div class="card">
          <div class="card__header">
            <h2>Recent transactions</h2>
            <a routerLink="/sales/invoices" class="btn btn--ghost btn--sm">View all</a>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Number</th><th>Contact</th><th>Date</th><th>Status</th><th class="text-right">Amount</th><th class="text-right">Balance</th></tr>
              </thead>
              <tbody>
                @for (r of d.recent; track r.id) {
                  <tr class="is-clickable" [routerLink]="link(r.type, r.id)">
                    <td class="nowrap"><span class="chip">{{ r.type === 'bill' ? 'BILL' : 'INV' }}</span> {{ r.number }}</td>
                    <td>{{ r.contact?.name }}</td>
                    <td class="nowrap">{{ r.date | date: 'dd MMM yyyy' }}</td>
                    <td><app-status-badge [status]="r.status" /></td>
                    <td class="text-right mono">{{ r.total | money }}</td>
                    <td class="text-right mono">{{ r.balance | money }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="muted text-center">No transactions yet — create your first invoice.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="side">
          <div class="card">
            <div class="card__header"><h2>At a glance</h2></div>
            <div class="glance">
              <a routerLink="/customers"><strong>{{ d.counts.customers }}</strong><span>Customers</span></a>
              <a routerLink="/vendors"><strong>{{ d.counts.vendors }}</strong><span>Vendors</span></a>
              <a routerLink="/items"><strong>{{ d.counts.items }}</strong><span>Items</span></a>
              <a routerLink="/sales/invoices"><strong>{{ d.counts.unpaid_invoices }}</strong><span>Unpaid invoices</span></a>
            </div>
          </div>
          <div class="card mt-2">
            <div class="card__header"><h2>Low stock</h2><app-icon name="alert" class="text-danger" /></div>
            @for (i of d.low_stock; track i.id) {
              <div class="list-row">
                <div><strong>{{ i.name }}</strong><span class="sub muted">{{ i.sku }}</span></div>
                <span class="badge" data-tone="danger">{{ i.stock_on_hand }} {{ i.unit }}</span>
              </div>
            } @empty {
              <p class="muted card__body">All items are well stocked.</p>
            }
          </div>
        </div>
      </section>
    } @else if (store.loading()) {
      <section class="kpis">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card kpi"><div style="flex:1"><div class="skeleton" style="width:50%"></div><div class="skeleton mt-1" style="height:24px"></div></div></div>
        }
      </section>
      <div class="card mt-2" style="height:320px"></div>
    }
  `,
})
export class Dashboard {
  protected readonly store = inject(DashboardStore);
  protected readonly auth = inject(AuthStore);
  protected readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0]);
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });
  protected readonly link = docPath;

  constructor() {
    this.store.load();
  }
}
