import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { ApiService } from '../../core/api/api.service';
import { Item } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';

export const ItemListStore = signalStore(withPaginatedList<Item>('items'));

@Component({
  selector: 'app-item-list',
  imports: [RouterLink, FormsModule, Icon, MoneyPipe, PageHeader, Pagination, EmptyState, Modal],
  providers: [ItemListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Items" subtitle="Products and services you buy and sell.">
      <a routerLink="/items/new" class="btn"><app-icon name="plus" /> New Item</a>
    </app-page-header>

    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input class="input" type="search" placeholder="Search name, SKU, HSN…" (input)="store.search($any($event.target).value)" />
        </label>
        <div class="segmented">
          <button type="button" [class.is-active]="view() === ''" (click)="filter('')">All</button>
          <button type="button" [class.is-active]="view() === 'goods'" (click)="filter('goods')">Goods</button>
          <button type="button" [class.is-active]="view() === 'service'" (click)="filter('service')">Services</button>
          <button type="button" [class.is-active]="view() === 'low'" (click)="filter('low')">Low stock</button>
        </div>
      </div>
      @if (store.loading()) {
        <div class="loading-bar"></div>
      }
      @if (store.isEmpty()) {
        <app-empty-state icon="box" title="No items found" message="Add products or services to use them on invoices and bills.">
          <a routerLink="/items/new" class="btn"><app-icon name="plus" /> Add item</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Item</th><th>Type</th><th class="text-right">Sales price</th><th class="text-right">Purchase price</th><th>Tax</th><th class="text-right">Stock</th><th></th></tr>
            </thead>
            <tbody>
              @for (i of store.entities(); track i.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/items', i.id, 'edit']" class="strong">{{ i.name }}</a>
                    @if (!i.is_active) { <span class="badge" data-tone="muted">inactive</span> }
                    <span class="sub">{{ i.sku }} {{ i.hsn_code ? '· HSN ' + i.hsn_code : '' }}</span>
                  </td>
                  <td><span class="chip">{{ i.type }}</span></td>
                  <td class="text-right mono">{{ i.sales_price | money }}</td>
                  <td class="text-right mono">{{ i.purchase_price ?? 0 | money }}</td>
                  <td>{{ i.tax?.name ?? '—' }}</td>
                  <td class="text-right mono">
                    @if (i.track_inventory) {
                      <span [class.text-danger]="(i.stock_on_hand ?? 0) <= (i.reorder_level ?? 0)" class="strong">{{ i.stock_on_hand }}</span> {{ i.unit }}
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td class="actions">
                    @if (i.track_inventory) {
                      <button type="button" class="btn btn--ghost btn--sm" (click)="openAdjust(i)">Adjust stock</button>
                    }
                    <a class="btn btn--ghost btn--sm btn--icon" [routerLink]="['/items', i.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(i)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
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

    @if (adjusting(); as item) {
      <app-modal [title]="'Adjust stock · ' + item.name" (closed)="adjusting.set(null)">
        <p class="muted">Current stock: <strong>{{ item.stock_on_hand }} {{ item.unit }}</strong>. Use a negative number to reduce stock.</p>
        <div class="form-grid mt-2">
          <div class="field"><label for="q">Quantity (+/-)</label><input id="q" class="input" type="number" [(ngModel)]="adjQty" /></div>
          <div class="field"><label for="d">Date</label><input id="d" class="input" type="date" [(ngModel)]="adjDate" /></div>
          <div class="field span-all"><label for="n">Reason</label><input id="n" class="input" [(ngModel)]="adjNotes" placeholder="Damaged, stock count, …" /></div>
        </div>
        <ng-container modal-footer>
          <button type="button" class="btn btn--outline" (click)="adjusting.set(null)">Cancel</button>
          <button type="button" class="btn" (click)="saveAdjust(item)" [disabled]="!adjQty">Save adjustment</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class ItemList implements OnInit {
  protected readonly store = inject(ItemListStore);
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<'' | 'goods' | 'service' | 'low'>('');
  protected readonly adjusting = signal<Item | null>(null);
  protected adjQty = 0;
  protected adjDate = isoDate();
  protected adjNotes = '';

  ngOnInit(): void {
    this.store.load();
  }

  filter(v: '' | 'goods' | 'service' | 'low'): void {
    this.view.set(v);
    this.store.setFilters({ type: v === 'low' ? '' : v, low_stock: v === 'low' ? 1 : '' });
  }

  openAdjust(i: Item): void {
    this.adjQty = 0;
    this.adjNotes = '';
    this.adjDate = isoDate();
    this.adjusting.set(i);
  }

  saveAdjust(i: Item): void {
    this.api.post<Item>(`items/${i.id}/adjust-stock`, { quantity: this.adjQty, date: this.adjDate, notes: this.adjNotes }).subscribe({
      next: () => {
        this.toast.success('Stock updated');
        this.adjusting.set(null);
        this.store.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  async remove(i: Item): Promise<void> {
    if (await this.confirm.ask(`Delete ${i.name}?`, 'Items used in transactions cannot be deleted — mark them inactive instead.', { confirmText: 'Delete', danger: true })) {
      this.store.remove(i.id, (msg) => this.toast.error(msg));
    }
  }
}
