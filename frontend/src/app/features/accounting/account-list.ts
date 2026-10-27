import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Account, AccountType } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { LookupsStore } from '../../core/state/lookups.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';

const TYPES: { type: AccountType; label: string }[] = [
  { type: 'asset', label: 'Assets' },
  { type: 'liability', label: 'Liabilities' },
  { type: 'equity', label: 'Equity' },
  { type: 'income', label: 'Income' },
  { type: 'expense', label: 'Expenses' },
];

@Component({
  selector: 'app-account-list',
  imports: [ReactiveFormsModule, Icon, PageHeader, Modal, FieldError, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Chart of Accounts" subtitle="The categories every transaction is classified into.">
      @if (auth.canDelete()) {
        <button type="button" class="btn" (click)="open()"><app-icon name="plus" /> New account</button>
      }
    </app-page-header>

    <div class="tabs">
      @for (t of types; track t.type) {
        <a href="" [class.is-active]="tab() === t.type" (click)="$event.preventDefault(); tab.set(t.type)">{{ t.label }} ({{ count(t.type) }})</a>
      }
    </div>

    <div class="card">
      @if (loading()) { <div class="loading-bar"></div> }
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th style="width:100px">Code</th><th>Account name</th><th>Sub type</th><th class="text-right">Opening balance</th><th></th></tr></thead>
          <tbody>
            @for (a of visible(); track a.id) {
              <tr>
                <td class="mono muted">{{ a.code }}</td>
                <td>
                  <strong>{{ a.name }}</strong>
                  @if (a.is_system) { <span class="badge" style="margin-left:6px">system</span> }
                  @if (!a.is_active) { <span class="badge" data-tone="muted">inactive</span> }
                  @if (a.description) { <span class="sub">{{ a.description }}</span> }
                </td>
                <td style="text-transform:capitalize">{{ (a.sub_type || '—').replace('_', ' ') }}</td>
                <td class="text-right mono">{{ a.opening_balance ?? 0 | money }}</td>
                <td class="actions">
                  @if (auth.canDelete()) {
                    <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="open(a)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
                    @if (!a.is_system) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(a)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing()) {
      <app-modal [title]="editingAccount() ? 'Edit account' : 'New account'" (closed)="editing.set(false)">
        <form id="acc-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
          <div class="field">
            <label class="req" for="at">Type</label>
            <select id="at" class="select" formControlName="type">
              @for (t of types; track t.type) { <option [value]="t.type">{{ t.label }}</option> }
            </select>
          </div>
          <div class="field">
            <label class="req" for="ac">Code</label>
            <input id="ac" class="input" formControlName="code" />
            <app-field-error [control]="form.controls.code" label="Code" [server]="errors()['code']" />
          </div>
          <div class="field span-all">
            <label class="req" for="an">Name</label>
            <input id="an" class="input" formControlName="name" />
            <app-field-error [control]="form.controls.name" label="Name" />
          </div>
          <div class="field"><label for="ast">Sub type</label><input id="ast" class="input" formControlName="sub_type" placeholder="e.g. bank, expense" /></div>
          <div class="field"><label for="aob">Opening balance</label><input id="aob" class="input" type="number" step="0.01" formControlName="opening_balance" /></div>
          <div class="field span-all"><label for="ad">Description</label><textarea id="ad" class="textarea" formControlName="description" rows="2"></textarea></div>
          <label class="checkbox"><input type="checkbox" formControlName="is_active" /> Active</label>
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn--outline" (click)="editing.set(false)">Cancel</button>
          <button type="submit" form="acc-form" class="btn">Save</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class AccountList implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lookups = inject(LookupsStore);
  protected readonly auth = inject(AuthStore);

  protected readonly types = TYPES;
  protected readonly accounts = signal<Account[]>([]);
  protected readonly loading = signal(false);
  protected readonly tab = signal<AccountType>('asset');
  protected readonly visible = computed(() => this.accounts().filter((a) => a.type === this.tab()));
  protected readonly editing = signal(false);
  protected readonly editingAccount = signal<Account | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(NonNullableFormBuilder).group({
    type: ['expense' as AccountType, Validators.required],
    code: ['', Validators.required],
    name: ['', Validators.required],
    sub_type: [''],
    opening_balance: [0],
    description: [''],
    is_active: [true],
  });

  count(t: AccountType): number {
    return this.accounts().filter((a) => a.type === t).length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<Account[]>('accounts').subscribe((a) => {
      this.accounts.set(a);
      this.loading.set(false);
    });
  }

  open(a?: Account): void {
    this.errors.set({});
    this.editingAccount.set(a ?? null);
    this.form.reset({ type: a?.type ?? this.tab(), code: a?.code ?? '', name: a?.name ?? '', sub_type: a?.sub_type ?? '', opening_balance: a?.opening_balance ?? 0, description: a?.description ?? '', is_active: a?.is_active ?? true });
    if (a?.is_system) {
      this.form.controls.type.disable();
      this.form.controls.code.disable();
    } else {
      this.form.controls.type.enable();
      this.form.controls.code.enable();
    }
    this.editing.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const a = this.editingAccount();
    const body = this.form.getRawValue();
    (a ? this.api.put<Account>(`accounts/${a.id}`, body) : this.api.post<Account>('accounts', body)).subscribe({
      next: () => {
        this.toast.success('Account saved');
        this.editing.set(false);
        this.load();
        this.lookups.load({ force: true });
      },
      error: (e) => {
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }

  async remove(a: Account): Promise<void> {
    if (await this.confirm.ask(`Delete ${a.name}?`, 'Accounts with transactions cannot be deleted.', { confirmText: 'Delete', danger: true })) {
      this.api.delete(`accounts/${a.id}`).subscribe({
        next: () => {
          this.toast.success('Account deleted');
          this.load();
          this.lookups.load({ force: true });
        },
        error: (e) => this.toast.error(errorMessage(e)),
      });
    }
  }
}
