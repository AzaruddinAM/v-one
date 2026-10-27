import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { Journal } from '../../core/api/models';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';

export const JournalListStore = signalStore(withPaginatedList<Journal>('journals'));

@Component({
  selector: 'app-journal-list',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, Pagination, EmptyState],
  providers: [JournalListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Manual Journals" subtitle="Double-entry adjustments: opening balances, depreciation, transfers and more.">
      <a routerLink="/accounting/journals/new" class="btn"><app-icon name="plus" /> New journal</a>
    </app-page-header>
    <div class="card">
      <div class="toolbar">
        <label class="search"><app-icon name="search" /><input class="input" type="search" placeholder="Search…" (input)="store.search($any($event.target).value)" /></label>
      </div>
      @if (store.loading()) { <div class="loading-bar"></div> }
      @if (store.isEmpty()) {
        <app-empty-state icon="journal" title="No journals" message="Record adjustments that don't fit an invoice, bill or expense.">
          <a routerLink="/accounting/journals/new" class="btn"><app-icon name="plus" /> New journal</a>
        </app-empty-state>
      } @else {
        <table class="table">
          <thead><tr><th>Date</th><th>Journal #</th><th>Reference</th><th>Notes</th><th class="text-right">Amount</th><th></th></tr></thead>
          <tbody>
            @for (j of store.entities(); track j.id) {
              <tr class="is-clickable" [routerLink]="['/accounting/journals', j.id, 'edit']">
                <td>{{ j.date | date: 'dd MMM yyyy' }}</td>
                <td class="strong">{{ j.number }}</td>
                <td>{{ j.reference || '—' }}</td>
                <td class="muted">{{ j.notes }}</td>
                <td class="text-right mono">{{ j.total | money }}</td>
                <td class="actions" (click)="$event.stopPropagation()">
                  <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(j)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <app-pagination [page]="store.page()" [lastPage]="store.lastPage()" [label]="store.rangeLabel()" (go)="store.goTo($event)" />
      }
    </div>
  `,
})
export class JournalList implements OnInit {
  protected readonly store = inject(JournalListStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  ngOnInit(): void {
    this.store.load();
  }

  async remove(j: Journal): Promise<void> {
    if (await this.confirm.ask(`Delete ${j.number}?`, 'This cannot be undone.', { confirmText: 'Delete', danger: true })) {
      this.store.remove(j.id, (m) => this.toast.error(m));
    }
  }
}
