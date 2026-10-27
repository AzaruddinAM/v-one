import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Item } from '../../core/api/models';
import { LookupsStore } from '../../core/state/lookups.store';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="id() ? 'Edit item' : 'New item'" />
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="card__body">
        <div class="form-section">
          <div class="field" style="margin-bottom:16px">
            <span class="label">Type</span>
            <div class="segmented" style="align-self:flex-start">
              <button type="button" [class.is-active]="type() === 'goods'" (click)="form.controls.type.setValue('goods')">Goods</button>
              <button type="button" [class.is-active]="type() === 'service'" (click)="form.controls.type.setValue('service')">Service</button>
            </div>
          </div>
          <div class="form-grid">
            <div class="field span-2">
              <label class="req" for="name">Name</label>
              <input id="name" class="input" formControlName="name" />
              <app-field-error [control]="form.controls.name" label="Name" [server]="errors()['name']" />
            </div>
            <div class="field">
              <label for="sku">SKU</label>
              <input id="sku" class="input" formControlName="sku" />
              <app-field-error [server]="errors()['sku']" />
            </div>
            <div class="field">
              <label for="unit">Unit</label>
              <select id="unit" class="select" formControlName="unit">
                @for (u of lookups.units(); track u) { <option [value]="u">{{ u }}</option> }
              </select>
            </div>
            <div class="field"><label for="hsn">{{ type() === 'goods' ? 'HSN code' : 'SAC code' }}</label><input id="hsn" class="input" formControlName="hsn_code" /></div>
            <div class="field"><label for="cat">Category</label><input id="cat" class="input" formControlName="category" list="cats" /></div>
            <datalist id="cats">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist>
          </div>
        </div>
        <div class="form-section">
          <h3>Pricing & tax</h3>
          <div class="form-grid">
            <div class="field">
              <label class="req" for="sp">Selling price</label>
              <input id="sp" class="input" type="number" step="0.01" min="0" formControlName="sales_price" />
              <app-field-error [control]="form.controls.sales_price" label="Selling price" />
            </div>
            <div class="field"><label for="pp">Cost price</label><input id="pp" class="input" type="number" step="0.01" min="0" formControlName="purchase_price" /></div>
            <div class="field">
              <label for="tax">Tax</label>
              <select id="tax" class="select" formControlName="tax_id">
                <option [ngValue]="null">Non-taxable</option>
                @for (t of lookups.taxes(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
              </select>
            </div>
            <div class="field span-all"><label for="desc">Description</label><textarea id="desc" class="textarea" formControlName="description"></textarea></div>
          </div>
        </div>
        @if (type() === 'goods') {
          <div class="form-section">
            <h3>Inventory</h3>
            <label class="checkbox"><input type="checkbox" formControlName="track_inventory" /> Track inventory for this item</label>
            @if (form.controls.track_inventory.value) {
              <div class="form-grid mt-2">
                @if (!id()) {
                  <div class="field"><label for="os">Opening stock</label><input id="os" class="input" type="number" min="0" formControlName="opening_stock" /></div>
                }
                <div class="field"><label for="rl">Reorder level</label><input id="rl" class="input" type="number" min="0" formControlName="reorder_level" /></div>
              </div>
            }
          </div>
        }
        <div class="form-section">
          <label class="checkbox"><input type="checkbox" formControlName="is_active" /> Active</label>
        </div>
      </div>
      <div class="card__footer form-actions">
        <a routerLink="/items" class="btn btn--outline">Cancel</a>
        <button type="submit" class="btn" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save item' }}</button>
      </div>
    </form>
  `,
})
export class ItemForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly lookups = inject(LookupsStore);

  readonly id = input<string>();
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly categories = signal<string[]>([]);

  protected readonly form = inject(NonNullableFormBuilder).group({
    type: ['goods' as 'goods' | 'service'],
    name: ['', Validators.required],
    sku: [''],
    unit: ['pcs'],
    hsn_code: [''],
    category: [''],
    description: [''],
    sales_price: [0, [Validators.required, Validators.min(0)]],
    purchase_price: [0, Validators.min(0)],
    tax_id: [null as number | null],
    track_inventory: [true],
    opening_stock: [0],
    reorder_level: [0],
    is_active: [true],
  });
  protected readonly type = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });

  ngOnInit(): void {
    this.api.get<string[]>('items/categories').subscribe((c) => this.categories.set(c));
    const id = this.id();
    if (id) this.api.get<Item>(`items/${id}`).subscribe((i) => this.form.patchValue(i as never));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const id = this.id();
    const body = this.form.getRawValue();
    (id ? this.api.put<Item>(`items/${id}`, body) : this.api.post<Item>('items', body)).subscribe({
      next: () => {
        this.toast.success('Item saved');
        void this.router.navigateByUrl('/items');
      },
      error: (e) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }
}
