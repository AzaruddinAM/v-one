import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { Payment } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { docPath } from '../../core/documents.config';
import { LookupsStore } from '../../core/state/lookups.store';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';
import { PaymentDialog } from './payment-dialog';

export const PaymentListStore = signalStore(withPaginatedList<Payment>('payments'));

@Component({
  selector: 'app-payment-list',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, Pagination, EmptyState, PaymentDialog],
  providers: [PaymentListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="title()" [subtitle]="direction() === 'in' ? 'Money received from customers.' : 'Money paid to vendors.'">
      <button type="button" class="btn" (click)="recording.set(true)"><app-icon name="plus" /> Record payment</button>
    </app-page-header>

    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input class="input" type="search" placeholder="Search number, reference, contact…" (input)="store.search($any($event.target).value)" />
        </label>
        <select class="select" style="width:auto" (change)="store.setFilters({ mode: $any($event.target).value })">
          <option value="">All modes</option>
          @for (m of lookups.paymentModes(); track m) { <option [value]="m">{{ m.replace('_', ' ') }}</option> }
        </select>
      </div>
      @if (store.loading()) { <div class="loading-bar"></div> }
      @if (store.isEmpty()) {
        <app-empty-state icon="card" title="No payments yet" message="Payments you record will appear here." />
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Payment #</th><th>{{ direction() === 'in' ? 'Customer' : 'Vendor' }}</th><th>Against</th><th>Mode</th><th>Reference</th><th class="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              @for (p of store.entities(); track p.id) {
                <tr>
                  <td class="nowrap">{{ p.date | date: 'dd MMM yyyy' }}</td>
                  <td class="strong">{{ p.number }}</td>
                  <td>{{ p.contact?.name }}</td>
                  <td>
                    @if (p.document) { <a [routerLink]="link(p.document.type, p.document.id)">{{ p.document.number }}</a> } @else { <span class="muted">Advance</span> }
                  </td>
                  <td style="text-transform:capitalize">{{ p.mode.replace('_', ' ') }}</td>
                  <td>{{ p.reference || '—' }}</td>
                  <td class="text-right mono strong">{{ p.amount | money }}</td>
                  <td class="actions">
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(p)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="store.page()" [lastPage]="store.lastPage()" [label]="store.rangeLabel()" (go)="store.goTo($event)" />
      }
    </div>

    @if (recording()) {
      <app-payment-dialog [direction]="direction()" (closed)="recording.set(false)" (saved)="recording.set(false); store.load()" />
    }
  `,
})
export class PaymentList implements OnInit {
  protected readonly store = inject(PaymentListStore);
  protected readonly auth = inject(AuthStore);
  protected readonly lookups = inject(LookupsStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly direction = input<'in' | 'out'>('in');
  protected readonly title = computed(() => (this.direction() === 'in' ? 'Payments Received' : 'Payments Made'));
  protected readonly recording = signal(false);
  protected readonly link = docPath;

  ngOnInit(): void {
    this.store.setFilters({ direction: this.direction() });
  }

  async remove(p: Payment): Promise<void> {
    if (await this.confirm.ask(`Delete ${p.number}?`, 'The linked invoice/bill balance will be updated.', { confirmText: 'Delete', danger: true })) {
      this.store.remove(p.id, (m) => this.toast.error(m));
    }
  }
}
