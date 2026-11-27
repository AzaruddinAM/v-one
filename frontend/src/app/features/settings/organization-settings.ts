import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Organization, TaxRegime } from '../../core/api/models';
import { LookupsStore } from '../../core/state/lookups.store';
import { REGIME_DEFAULTS, TAX_REGIMES, taxProfile } from '../../core/tax-regime';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';

import { DEFAULT_REMINDER } from '../reminders/reminder-text';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENCIES = [
  ['INR', '₹'], ['USD', '$'], ['EUR', '€'], ['GBP', '£'], ['AED', 'AED'], ['SAR', '﷼'], ['QAR', 'ر.ق'], ['OMR', 'ر.ع.'], ['KWD', 'د.ك'], ['SGD', 'S$'], ['AUD', 'A$'], ['CAD', 'C$'],
];

@Component({
  selector: 'app-organization-settings',
  imports: [ReactiveFormsModule, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="card__body">
        @if (!auth.isAdmin()) { <div class="alert alert--info" style="margin-bottom:16px">Only administrators can change organization settings.</div> }
        <div class="form-section">
          <h3>Business profile</h3>
          <div class="form-grid">
            <div class="field span-2">
              <label class="req" for="on">Organization name</label>
              <input id="on" class="input" formControlName="name" />
              <app-field-error [control]="form.controls.name" label="Name" />
            </div>
            <div class="field"><label for="oi">Industry</label><input id="oi" class="input" formControlName="industry" placeholder="Retail, Services…" /></div>
            <div class="field">
              <label for="otr">Tax system</label>
              <select id="otr" class="select" formControlName="tax_regime" (change)="applyRegime()">
                @for (r of regimes; track r.id) { <option [value]="r.id">{{ r.label }}</option> }
              </select>
              <small class="muted">{{ regimeHint() }}</small>
            </div>
            <div class="field"><label for="og">{{ profile().idLabel }}</label><input id="og" class="input" formControlName="gstin" [placeholder]="profile().idPlaceholder" /></div>
            <div class="field"><label for="op">Phone</label><input id="op" class="input" formControlName="phone" /></div>
            <div class="field"><label for="oe">Email</label><input id="oe" class="input" type="email" formControlName="email" /></div>
            <div class="field span-all"><label for="oa">Address</label><textarea id="oa" class="textarea" formControlName="address" rows="2"></textarea></div>
            <div class="field"><label for="oc">City</label><input id="oc" class="input" formControlName="city" /></div>
            <div class="field"><label for="os">State</label><input id="os" class="input" formControlName="state" /></div>
            <div class="field"><label for="oco">Country</label><input id="oco" class="input" formControlName="country" /></div>
            <div class="field"><label for="opi">{{ profile().regime === 'gst' ? 'PIN code' : 'Postal code / PO Box' }}</label><input id="opi" class="input" formControlName="pincode" /></div>
          </div>
        </div>
        <div class="form-section">
          <h3>Preferences</h3>
          <div class="form-grid">
            <div class="field">
              <label for="cur">Base currency</label>
              <select id="cur" class="select" formControlName="currency" (change)="syncSymbol()">
                @for (c of currencies; track c[0]) { <option [value]="c[0]">{{ c[0] }} ({{ c[1] }})</option> }
              </select>
            </div>
            <div class="field">
              <label for="fy">Financial year starts</label>
              <select id="fy" class="select" formControlName="fiscal_year_start">
                @for (m of months; track $index) { <option [ngValue]="$index + 1">{{ m }}</option> }
              </select>
            </div>
            <div class="field span-all"><label for="ot">Default invoice terms</label><textarea id="ot" class="textarea" formControlName="invoice_terms" rows="2"></textarea></div>
            <div class="field span-all"><label for="ono">Default customer notes</label><textarea id="ono" class="textarea" formControlName="invoice_notes" rows="2"></textarea></div>
            <div class="field span-all">
              <label for="orm">Payment reminder message</label>
              <textarea id="orm" class="textarea" formControlName="reminder_template" rows="4" [placeholder]="defaultReminder"></textarea>
              <small class="muted">Used on the Payment Reminders page. Placeholders: {{ '{customer} {invoice} {amount} {due_date} {days} {org}' }}. Leave empty for the default.</small>
            </div>
          </div>
        </div>
      </div>
      @if (auth.isAdmin()) {
        <div class="card__footer form-actions"><button type="submit" class="btn" [disabled]="saving()">Save changes</button></div>
      }
    </form>
  `,
})
export class OrganizationSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly months = MONTHS;
  protected readonly currencies = CURRENCIES;
  protected readonly saving = signal(false);
  protected readonly regimes = TAX_REGIMES;
  private readonly lookups = inject(LookupsStore);
  protected readonly defaultReminder = DEFAULT_REMINDER;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    industry: [''],
    tax_regime: ['gst' as TaxRegime],
    gstin: [''],
    phone: [''],
    email: [''],
    address: [''],
    city: [''],
    state: [''],
    country: [''],
    pincode: [''],
    currency: ['INR'],
    currency_symbol: ['₹'],
    fiscal_year_start: [4],
    invoice_terms: [''],
    invoice_notes: [''],
    reminder_template: [''],
  });

  private readonly regime = toSignal(this.form.controls.tax_regime.valueChanges, { initialValue: this.form.controls.tax_regime.value });
  protected readonly profile = computed(() => taxProfile({ tax_regime: this.regime() }));
  protected readonly regimeHint = computed(() => TAX_REGIMES.find((r) => r.id === this.regime())?.hint ?? '');

  /** Switching tax system fills the usual currency, symbol, financial year and country for it. */
  applyRegime(): void {
    const d = REGIME_DEFAULTS[this.form.controls.tax_regime.value];
    this.form.patchValue({ currency: d.currency, currency_symbol: d.currency_symbol, fiscal_year_start: d.fiscal_year_start, ...(d.country ? { country: d.country } : {}) });
  }

  ngOnInit(): void {
    this.api.get<Organization>('organization').subscribe((o) => this.form.patchValue({ ...o, tax_regime: o.tax_regime ?? 'gst', reminder_template: o.reminder_template ?? '' } as never));
    if (!this.auth.isAdmin()) this.form.disable();
  }

  syncSymbol(): void {
    const c = CURRENCIES.find((x) => x[0] === this.form.controls.currency.value);
    if (c) this.form.controls.currency_symbol.setValue(c[1]);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.put<Organization>('organization', this.form.getRawValue()).subscribe({
      next: (o) => {
        this.auth.setOrganization(o);
        this.lookups.load({ force: true }); // tax rates change with the tax system
        this.saving.set(false);
        this.toast.success('Organization updated');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
