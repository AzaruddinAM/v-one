import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { AuthStore } from '../../core/auth/auth.store';
import { Contact, ContactType } from '../../core/api/models';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';

export const ContactListStore = signalStore(withPaginatedList<Contact>('contacts'));

@Component({
  selector: 'app-contact-list',
  imports: [RouterLink, Icon, MoneyPipe, PageHeader, Pagination, EmptyState],
  providers: [ContactListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="plural()" [subtitle]="'Manage your ' + plural().toLowerCase() + ' and their balances.'">
      <a [routerLink]="['/' + base(), 'new']" class="btn"><app-icon name="plus" /> New {{ singular() }}</a>
    </app-page-header>

    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input class="input" type="search" placeholder="Search name, company, phone…" (input)="store.search($any($event.target).value)" />
        </label>
        <select class="select" style="width:auto" (change)="store.setFilters({ active: $any($event.target).value })">
          <option value="">All</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </div>
      @if (store.loading()) {
        <div class="loading-bar"></div>
      }
      @if (store.isEmpty()) {
        <app-empty-state [icon]="contactType() === 'customer' ? 'users' : 'truck'" [title]="'No ' + plural().toLowerCase() + ' found'" message="Add your first one to start billing.">
          <a [routerLink]="['/' + base(), 'new']" class="btn"><app-icon name="plus" /> Add {{ singular() }}</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>City</th>
                <th class="text-right">{{ contactType() === 'customer' ? 'Receivable' : 'Payable' }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of store.entities(); track c.id) {
                <tr class="is-clickable" [routerLink]="['/' + base(), c.id]">
                  <td>
                    <div class="gap">
                      <div class="avatar">{{ c.name.charAt(0) }}</div>
                      <div>
                        <strong>{{ c.name }}</strong>
                        @if (!c.is_active) { <span class="badge" data-tone="muted">inactive</span> }
                        <span class="sub">{{ c.company_name }}</span>
                      </div>
                    </div>
                  </td>
                  <td>{{ c.phone }}<span class="sub">{{ c.email }}</span></td>
                  <td>{{ c.city }}</td>
                  <td class="text-right mono strong">{{ c.outstanding ?? 0 | money }}</td>
                  <td class="actions" (click)="$event.stopPropagation()">
                    <a class="btn btn--ghost btn--sm btn--icon" [routerLink]="['/' + base(), c.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(c)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
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
export class ContactList implements OnInit {
  protected readonly store = inject(ContactListStore);
  protected readonly auth = inject(AuthStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly contactType = input<ContactType>('customer');
  protected readonly singular = computed(() => (this.contactType() === 'customer' ? 'Customer' : 'Vendor'));
  protected readonly plural = computed(() => this.singular() + 's');
  protected readonly base = computed(() => (this.contactType() === 'customer' ? 'customers' : 'vendors'));

  ngOnInit(): void {
    this.store.setFilters({ type: this.contactType() });
  }

  async remove(c: Contact): Promise<void> {
    if (await this.confirm.ask(`Delete ${c.name}?`, 'This cannot be undone.', { confirmText: 'Delete', danger: true })) {
      this.store.remove(c.id, (msg) => this.toast.error(msg));
    }
  }
}
