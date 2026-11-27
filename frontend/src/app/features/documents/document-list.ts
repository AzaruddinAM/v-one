import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { DocumentSummary, DocumentType } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';
import { StatusBadge } from '../../shared/status-badge';

export const DocumentListStore = signalStore(withPaginatedList<DocumentSummary>('documents'));

const STATUS_TABS: Record<DocumentType, string[]> = {
  estimate: ['draft', 'sent', 'accepted', 'declined'],
  sales_order: ['draft', 'open', 'closed', 'void'],
  delivery_challan: ['draft', 'open', 'delivered', 'invoiced', 'returned', 'void'],
  invoice: ['draft', 'sent', 'partial', 'overdue', 'paid', 'void'],
  credit_note: ['draft', 'open', 'void'],
  purchase_order: ['draft', 'open', 'closed', 'void'],
  bill: ['draft', 'open', 'partial', 'overdue', 'paid', 'void'],
  vendor_credit: ['draft', 'open', 'closed', 'void'],
};

@Component({
  selector: 'app-document-list',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, Pagination, EmptyState, StatusBadge],
  providers: [DocumentListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="cfg().plural" [subtitle]="subtitle()">
      <a [routerLink]="[cfg().path, 'new']" class="btn"><app-icon name="plus" /> New {{ cfg().label }}</a>
    </app-page-header>

    <div class="tabs">
      <a href="" [class.is-active]="status() === ''" (click)="setStatus('', $event)">All</a>
      @for (s of statuses(); track s) {
        <a href="" [class.is-active]="status() === s" (click)="setStatus(s, $event)" style="text-transform:capitalize">{{ s }}</a>
      }
    </div>

    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input class="input" type="search" placeholder="Search number, reference, {{ cfg().contactType }}…" (input)="store.search($any($event.target).value)" />
        </label>
        <div class="gap">
          <input class="input" type="date" style="width:auto" aria-label="From" (change)="store.setFilters({ from: $any($event.target).value })" />
          <span class="muted">to</span>
          <input class="input" type="date" style="width:auto" aria-label="To" (change)="store.setFilters({ to: $any($event.target).value })" />
        </div>
      </div>
      @if (store.loading()) {
        <div class="loading-bar"></div>
      }
      @if (store.isEmpty()) {
        <app-empty-state [icon]="cfg().icon" [title]="'No ' + cfg().plural.toLowerCase() + ' yet'" [message]="'Create your first ' + cfg().label.toLowerCase() + ' in a few seconds.'">
          <a [routerLink]="[cfg().path, 'new']" class="btn"><app-icon name="plus" /> New {{ cfg().label }}</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>{{ cfg().contactType === 'customer' ? 'Customer' : 'Vendor' }}</th>
                <th>{{ cfg().dueLabel }}</th>
                <th>Status</th>
                <th class="text-right">Amount</th>
                @if (cfg().payable) { <th class="text-right">Balance due</th> }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (d of store.entities(); track d.id) {
                <tr class="is-clickable" [routerLink]="[cfg().path, d.id]">
                  <td class="nowrap">{{ d.date | date: 'dd MMM yyyy' }}</td>
                  <td class="strong">{{ d.number }}</td>
                  <td>{{ d.contact?.name }}<span class="sub">{{ d.contact?.company_name }}</span></td>
                  <td class="nowrap">{{ d.due_date ? (d.due_date | date: 'dd MMM yyyy') : '—' }}</td>
                  <td><app-status-badge [status]="d.status" /></td>
                  <td class="text-right mono">{{ d.total | money }}</td>
                  @if (cfg().payable) { <td class="text-right mono strong">{{ d.balance | money }}</td> }
                  <td class="actions" (click)="$event.stopPropagation()">
                    @if (d.status !== 'void') {
                      <a class="btn btn--ghost btn--sm btn--icon" [routerLink]="[cfg().path, d.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
                    }
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(d)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
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
  `,
})
export class DocumentList implements OnInit {
  protected readonly store = inject(DocumentListStore);
  protected readonly auth = inject(AuthStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly docType = input<DocumentType>('invoice');
  protected readonly cfg = computed(() => DOC_CONFIG[this.docType()]);
  protected readonly statuses = computed(() => STATUS_TABS[this.docType()]);
  protected readonly status = signal('');
  protected readonly subtitle = computed(() =>
    this.cfg().contactType === 'customer' ? 'Track what your customers owe you.' : 'Track what you owe your vendors.',
  );

  ngOnInit(): void {
    this.store.setFilters({ type: this.docType() });
  }

  setStatus(s: string, e: Event): void {
    e.preventDefault();
    this.status.set(s);
    this.store.setFilters({ status: s });
  }

  async remove(d: DocumentSummary): Promise<void> {
    const ok = await this.confirm.ask(`Delete ${d.number}?`, 'Linked payments will be removed and stock restored. This cannot be undone.', {
      confirmText: 'Delete',
      danger: true,
    });
    if (ok) this.store.remove(d.id, (msg) => this.toast.error(msg));
  }
}
