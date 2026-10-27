import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { signalStore } from '@ngrx/signals';
import { map } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Contact, Expense } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { LookupsStore } from '../../core/state/lookups.store';
import { withPaginatedList } from '../../core/state/list-store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { round2 } from '../../core/utils/totals';
import { EmptyState } from '../../shared/empty-state';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Pagination } from '../../shared/pagination';
import { Typeahead } from '../../shared/typeahead';

export const ExpenseListStore = signalStore(withPaginatedList<Expense>('expenses'));

@Component({
  selector: 'app-expense-list',
  imports: [DatePipe, ReactiveFormsModule, Icon, MoneyPipe, PageHeader, Pagination, EmptyState, Modal, FieldError, Typeahead],
  providers: [ExpenseListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Expenses" subtitle="Rent, salaries, utilities and every other business spend.">
      <button type="button" class="btn" (click)="open()"><app-icon name="plus" /> Record expense</button>
    </app-page-header>

    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input class="input" type="search" placeholder="Search reference or description…" (input)="store.search($any($event.target).value)" />
        </label>
        <select class="select" style="width:auto" (change)="store.setFilters({ account_id: $any($event.target).value })">
          <option value="">All categories</option>
          @for (a of lookups.expenseAccounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
      </div>
      @if (store.loading()) { <div class="loading-bar"></div> }
      @if (store.isEmpty()) {
        <app-empty-state icon="wallet" title="No expenses recorded" message="Track spending to see your true profit.">
          <button type="button" class="btn" (click)="open()"><app-icon name="plus" /> Record expense</button>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th>Paid through</th><th class="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              @for (e of store.entities(); track e.id) {
                <tr class="is-clickable" (click)="open(e)">
                  <td class="nowrap">{{ e.date | date: 'dd MMM yyyy' }}</td>
                  <td><span class="chip">{{ e.account?.name }}</span></td>
                  <td>{{ e.description || '—' }}<span class="sub">{{ e.reference }}</span></td>
                  <td>{{ e.contact?.name || '—' }}</td>
                  <td>{{ e.paid_through?.name || '—' }}</td>
                  <td class="text-right mono strong">{{ e.total | money }}</td>
                  <td class="actions" (click)="$event.stopPropagation()">
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(e)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
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

    @if (editing()) {
      <app-modal [title]="editingId() ? 'Edit expense' : 'Record expense'" [width]="600" (closed)="editing.set(false)">
        <form [formGroup]="form" id="expense-form" (ngSubmit)="save()" class="form-grid" novalidate>
          <div class="field">
            <label class="req" for="ed">Date</label>
            <input id="ed" class="input" type="date" formControlName="date" />
          </div>
          <div class="field">
            <label class="req" for="ea">Category</label>
            <select id="ea" class="select" formControlName="account_id">
              <option [ngValue]="null" disabled>Select…</option>
              @for (a of lookups.expenseAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
            </select>
            <app-field-error [control]="form.controls.account_id" label="Category" />
          </div>
          <div class="field">
            <label class="req" for="eamt">Amount</label>
            <input id="eamt" class="input" type="number" min="0" step="0.01" formControlName="amount" />
            <app-field-error [control]="form.controls.amount" label="Amount" />
          </div>
          <div class="field">
            <label for="et">Tax</label>
            <select id="et" class="select" formControlName="tax_id">
              <option [ngValue]="null">No tax</option>
              @for (t of lookups.taxes(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="ep">Paid through</label>
            <select id="ep" class="select" formControlName="paid_through_id">
              <option [ngValue]="null">—</option>
              @for (a of lookups.paymentAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="ev">Vendor</label>
            <app-typeahead inputId="ev" [search]="searchVendors" [display]="name" [(text)]="vendorText" (picked)="form.controls.contact_id.setValue($event.id)" placeholder="Optional" />
          </div>
          <div class="field"><label for="er">Reference #</label><input id="er" class="input" formControlName="reference" /></div>
          <div class="field span-all"><label for="edesc">Description</label><textarea id="edesc" class="textarea" formControlName="description" rows="2"></textarea></div>
          <div class="span-all alert alert--info">Total with tax: <strong>&nbsp;{{ total() | money }}</strong></div>
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn--outline" (click)="editing.set(false)">Cancel</button>
          <button type="submit" form="expense-form" class="btn" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class ExpenseList implements OnInit {
  protected readonly store = inject(ExpenseListStore);
  protected readonly auth = inject(AuthStore);
  protected readonly lookups = inject(LookupsStore);
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly editing = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly vendorText = signal('');
  private readonly amount = signal(0);
  private readonly taxId = signal<number | null>(null);
  protected readonly total = computed(() => round2(this.amount() * (1 + this.lookups.taxRate(this.taxId()) / 100)));

  protected readonly form = inject(NonNullableFormBuilder).group({
    date: [isoDate(), Validators.required],
    account_id: [null as number | null, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    tax_id: [null as number | null],
    paid_through_id: [null as number | null],
    contact_id: [null as number | null],
    reference: [''],
    description: [''],
  });

  protected readonly searchVendors = (q: string) => this.api.list<Contact>('contacts', { type: 'vendor', q, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly name = (c: Contact) => c.name;

  constructor() {
    this.form.valueChanges.subscribe((v) => {
      this.amount.set(Number(v.amount) || 0);
      this.taxId.set(v.tax_id ?? null);
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  open(e?: Expense): void {
    this.editingId.set(e?.id ?? null);
    this.form.reset({
      date: e?.date ?? isoDate(),
      account_id: e?.account_id ?? null,
      amount: e?.amount ?? 0,
      tax_id: e?.tax_id ?? null,
      paid_through_id: e?.paid_through_id ?? this.lookups.paymentAccounts().find((a) => a.sub_type === 'bank')?.id ?? null,
      contact_id: e?.contact_id ?? null,
      reference: e?.reference ?? '',
      description: e?.description ?? '',
    });
    this.vendorText.set(e?.contact?.name ?? '');
    this.editing.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const id = this.editingId();
    const body = this.form.getRawValue();
    (id ? this.api.put<Expense>(`expenses/${id}`, body) : this.api.post<Expense>('expenses', body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.toast.success('Expense saved');
        this.store.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  async remove(e: Expense): Promise<void> {
    if (await this.confirm.ask('Delete expense?', 'This cannot be undone.', { confirmText: 'Delete', danger: true })) {
      this.store.remove(e.id, (m) => this.toast.error(m));
    }
  }
}
