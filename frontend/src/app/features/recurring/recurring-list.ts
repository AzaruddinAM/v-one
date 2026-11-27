import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Paginated, RecurringProfile, RecurringType } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { docPath } from '../../core/documents.config';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { StatusBadge } from '../../shared/status-badge';
import { calculateTotals } from '../../core/utils/totals';
import { LookupsStore } from '../../core/state/lookups.store';

const UNIT: Record<string, [string, string]> = { week: ['Weekly', 'weeks'], month: ['Monthly', 'months'], year: ['Yearly', 'years'] };

/** Recurring invoices (sales) or recurring bills (purchases): schedules that create documents automatically. */
@Component({
  selector: 'app-recurring-list',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, EmptyState, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="title()" [subtitle]="'Create ' + noun() + 's automatically on a schedule. Due ones are created every morning, and when you open the app.'">
      <button type="button" class="btn btn--outline" (click)="runNow()" [disabled]="running()"><app-icon name="refresh" [size]="16" /> Create due now</button>
      <a [routerLink]="[base(), 'new']" class="btn"><app-icon name="plus" /> New recurring {{ noun() }}</a>
    </app-page-header>

    <div class="card">
      @if (loading()) { <div class="loading-bar"></div> }
      @if (!loading() && !rows().length) {
        <app-empty-state icon="repeat" [title]="'No recurring ' + noun() + 's yet'" [message]="hint()">
          <a [routerLink]="[base(), 'new']" class="btn"><app-icon name="plus" /> New recurring {{ noun() }}</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>{{ type() === 'bill' ? 'Vendor' : 'Customer' }}</th>
                <th>Frequency</th>
                <th>Next {{ noun() }}</th>
                <th>Status</th>
                <th class="text-right">Created</th>
                <th class="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr>
                  <td class="strong"><a [routerLink]="[base(), p.id, 'edit']">{{ p.name }}</a>
                    <span class="sub">{{ p.auto_send ? 'Created as ' + (type() === 'bill' ? 'open' : 'sent') : 'Created as draft' }}</span></td>
                  <td>{{ p.contact?.name }}<span class="sub">{{ p.contact?.company_name }}</span></td>
                  <td>{{ every(p) }}<span class="sub">from {{ p.start_date | date: 'dd MMM yyyy' }}{{ p.end_date ? ' to ' + (p.end_date | date: 'dd MMM yyyy') : '' }}</span></td>
                  <td class="nowrap">{{ p.status === 'active' ? (p.next_date | date: 'dd MMM yyyy') : '—' }}</td>
                  <td><app-status-badge [status]="p.status" /></td>
                  <td class="text-right mono">{{ p.generated_count }}</td>
                  <td class="text-right mono">{{ amount(p) | money }}</td>
                  <td class="actions">
                    @if (p.status === 'active') {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="setStatus(p, 'paused')" title="Pause" aria-label="Pause"><app-icon name="pause" [size]="16" /></button>
                    } @else if (p.status === 'paused') {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="setStatus(p, 'active')" title="Resume" aria-label="Resume"><app-icon name="play" [size]="16" /></button>
                    }
                    <a class="btn btn--ghost btn--sm btn--icon" [routerLink]="[base(), p.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(p)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (lastCreated().length) {
      <div class="card mt-2">
        <div class="card__header"><h2>Just created</h2></div>
        <div class="card__body">
          @for (d of lastCreated(); track d.id) {
            <a [routerLink]="link(d.id)" class="btn btn--outline btn--sm" style="margin:0 8px 8px 0">{{ d.number }} · {{ d.date | date: 'dd MMM' }}</a>
          }
        </div>
      </div>
    }
  `,
})
export class RecurringList implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lookups = inject(LookupsStore);
  protected readonly auth = inject(AuthStore);

  readonly recurringType = input<RecurringType>('invoice');
  protected readonly type = this.recurringType;
  protected readonly noun = computed(() => (this.type() === 'bill' ? 'bill' : 'invoice'));
  protected readonly title = computed(() => (this.type() === 'bill' ? 'Recurring Bills' : 'Recurring Invoices'));
  protected readonly base = computed(() => (this.type() === 'bill' ? '/purchases/recurring-bills' : '/sales/recurring-invoices'));
  protected readonly hint = computed(() =>
    this.type() === 'bill' ? 'Rent, internet, salaries… set them up once and the bills appear by themselves.' : 'Retainers, AMC, rent or subscriptions: bill your customers automatically.',
  );
  protected readonly rows = signal<RecurringProfile[]>([]);
  protected readonly loading = signal(true);
  protected readonly running = signal(false);
  protected readonly lastCreated = signal<{ id: number; number: string; date: string }[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<Paginated<RecurringProfile>>('recurring-profiles', { type: this.type(), per_page: 100 }).subscribe({
      next: (r) => {
        this.rows.set(r.data);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected every(p: RecurringProfile): string {
    const [adj, plural] = UNIT[p.frequency] ?? ['', p.frequency];
    return p.interval > 1 ? `Every ${p.interval} ${plural}` : adj;
  }

  protected amount(p: RecurringProfile): number {
    const rates = this.lookups.taxRates();
    const items = (p.template.items ?? []).map((l) => ({ ...l, tax_rate: l.tax_id ? (rates.get(l.tax_id) ?? 0) : 0 }));
    return calculateTotals(items, p.template.discount ?? 0, p.template.adjustment ?? 0).total;
  }

  protected link(id: number): string {
    return docPath(this.type(), id);
  }

  setStatus(p: RecurringProfile, status: 'active' | 'paused'): void {
    this.api.post<RecurringProfile>(`recurring-profiles/${p.id}/status`, { status }).subscribe({
      next: () => {
        this.toast.success(status === 'paused' ? 'Paused' : 'Resumed');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  runNow(): void {
    this.running.set(true);
    this.api.post<{ created: number; documents: { id: number; number: string; date: string }[] }>('recurring-profiles/run').subscribe({
      next: (r) => {
        this.running.set(false);
        this.lastCreated.set(r.documents);
        this.toast.success(r.created ? `${r.created} document(s) created` : 'Nothing is due today');
        this.load();
      },
      error: (e) => {
        this.running.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  async remove(p: RecurringProfile): Promise<void> {
    const ok = await this.confirm.ask(`Delete "${p.name}"?`, `No more ${this.noun()}s will be created. ${this.noun()}s already created are kept.`, { confirmText: 'Delete', danger: true });
    if (ok) {
      this.api.delete(`recurring-profiles/${p.id}`).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
    }
  }
}
