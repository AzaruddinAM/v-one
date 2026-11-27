import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Contact, Document, DocumentType, Item, RecurringFrequency, RecurringProfile } from '../../core/api/models';
import { taxProfile } from '../../core/tax-regime';
import { dueDateFor, PAYMENT_TERMS, termsForDays } from '../../core/utils/payment-terms';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { LookupsStore } from '../../core/state/lookups.store';
import { ToastService } from '../../core/ui/toast.service';
import { addDays, isoDate } from '../../core/utils/dates';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { calculateTotals } from '../../core/utils/totals';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Typeahead } from '../../shared/typeahead';

const SEND_STATUS: Record<DocumentType, string> = {
  estimate: 'sent',
  sales_order: 'open',
  delivery_challan: 'open',
  retainer_invoice: 'sent',
  vendor_credit: 'open',
  invoice: 'sent',
  credit_note: 'open',
  purchase_order: 'open',
  bill: 'open',
};

@Component({
  selector: 'app-document-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, FieldError, Icon, MoneyPipe, Typeahead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './document-form.scss',
  template: `
    <app-page-header [title]="(id() ? 'Edit ' : 'New ') + (recurring() ? 'Recurring ' : '') + cfg().label" [subtitle]="id() && !recurring() ? number() : ''" />

    <form [formGroup]="form" (ngSubmit)="save(sendStatus())" novalidate>
      @if (recurring()) {
        <div class="card" style="margin-bottom:16px" [formGroup]="schedule">
          <div class="card__header"><h2><app-icon name="repeat" [size]="18" /> Schedule</h2></div>
          <div class="card__body">
            <div class="form-grid">
              <div class="field span-2">
                <label class="req" for="rp-name">Profile name</label>
                <input id="rp-name" class="input" formControlName="name" placeholder="e.g. Monthly maintenance" />
                <app-field-error [control]="schedule.controls.name" label="Profile name" [server]="errors()['name']" />
              </div>
              <div class="field">
                <label for="rp-every">Repeat every</label>
                <div class="gap">
                  <input id="rp-every" class="input" type="number" min="1" max="36" style="width:80px" formControlName="interval" />
                  <select class="select" formControlName="frequency" aria-label="Frequency">
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                    <option value="year">year(s)</option>
                  </select>
                </div>
              </div>
              <div class="field">
                <label class="req" for="rp-start">Starts on</label>
                <input id="rp-start" class="input" type="date" formControlName="start_date" />
                <app-field-error [server]="errors()['start_date']" />
              </div>
              <div class="field">
                <label for="rp-end">Ends on</label>
                <input id="rp-end" class="input" type="date" formControlName="end_date" />
                <small class="muted">Leave empty to never end.</small>
                <app-field-error [server]="errors()['end_date']" />
              </div>
              <label class="checkbox span-2" style="align-self:center">
                <input type="checkbox" formControlName="auto_send" />
                Create as {{ sendStatus() === 'sent' ? 'sent' : 'open' }} (otherwise each {{ cfg().label.toLowerCase() }} is created as a draft for you to review)
              </label>
            </div>
            @if (id() && nextRun()) { <p class="muted small" style="margin:12px 0 0">Next {{ cfg().label.toLowerCase() }} will be created on {{ nextRun() }}.</p> }
          </div>
        </div>
      }
      <div class="card">
        <div class="card__body">
          <div class="form-grid head">
            <div class="field span-2">
              <label class="req" for="contact">{{ cfg().contactType === 'customer' ? 'Customer' : 'Vendor' }}</label>
              <app-typeahead
                inputId="contact"
                [search]="searchContacts"
                [display]="contactName"
                [meta]="contactMeta"
                [(text)]="contactText"
                placeholder="Search or select…"
                (picked)="pickContact($event)"
              />
              <app-field-error [control]="form.controls.contact_id" label="Contact" [server]="errors()['contact_id']" />
              @if (contact(); as c) {
                <small class="muted">{{ c.billing_address || c.city }} {{ c.gstin ? '· ' + tax.idLabel + ' ' + c.gstin : '' }}</small>
              }
            </div>
            @if (!recurring()) {
              <div class="field">
                <label for="number">{{ cfg().label }} #</label>
                <input id="number" class="input" formControlName="number" [placeholder]="nextNumber()" (input)="numberTyped = true" />
                <app-field-error [server]="errors()['number']" />
              </div>
            }
            <div class="field"><label for="ref">Reference</label><input id="ref" class="input" formControlName="reference" /></div>
            @if (!recurring()) {
              <div class="field">
                <label class="req" for="date">Date</label>
                <input id="date" class="input" type="date" formControlName="date" (change)="onDateChange()" />
              </div>
            }
            @if (cfg().payable) {
              <div class="field">
                <label for="pterms">Payment terms</label>
                <select id="pterms" class="select" formControlName="payment_terms" (change)="applyTerms()">
                  <option value="">Custom</option>
                  @for (t of paymentTerms; track t.label) { <option [value]="t.label">{{ t.label }}</option> }
                </select>
              </div>
            }
            @if (!recurring()) {
              <div class="field">
                <label for="due">{{ cfg().dueLabel }}</label>
                <input id="due" class="input" type="date" formControlName="due_date" (change)="form.controls.payment_terms.setValue('')" />
                <app-field-error [server]="errors()['due_date']" />
              </div>
            }
          </div>
        </div>

        <div class="table-wrap lines">
          <table class="table">
            <thead>
              <tr>
                <th style="min-width:240px">Item details</th>
                <th style="width:100px" class="text-right">Qty</th>
                <th style="width:130px" class="text-right">Rate</th>
                <th style="width:90px" class="text-right">Disc %</th>
                <th style="width:150px">Tax</th>
                <th style="width:130px" class="text-right">Amount</th>
                <th style="width:44px"></th>
              </tr>
            </thead>
            <tbody formArrayName="items">
              @for (line of lines.controls; track line; let i = $index) {
                <tr [formGroupName]="i">
                  <td>
                    <app-typeahead
                      [small]="true"
                      [search]="searchItems"
                      [display]="itemName"
                      [meta]="itemMeta"
                      [text]="line.controls.name.value"
                      (textChange)="line.controls.name.setValue($event); line.controls.name.markAsDirty()"
                      placeholder="Type or pick an item"
                      (picked)="pickItem(i, $event)"
                    />
                    <input class="input input--sm desc" formControlName="description" placeholder="Description (optional)" />
                    <app-field-error [server]="errors()['items.' + i + '.name']" />
                  </td>
                  <td><input class="input input--sm text-right" type="number" min="0" step="any" formControlName="quantity" /></td>
                  <td><input class="input input--sm text-right" type="number" min="0" step="0.01" formControlName="rate" /></td>
                  <td><input class="input input--sm text-right" type="number" min="0" max="100" step="0.01" formControlName="discount_percent" /></td>
                  <td>
                    <select class="select input--sm" formControlName="tax_id">
                      <option [ngValue]="null">No tax</option>
                      @for (t of lookups.taxes(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
                    </select>
                  </td>
                  <td class="text-right mono strong">{{ totals().lines[i]?.amount ?? 0 | money: false }}</td>
                  <td>
                    <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="removeLine(i)" [disabled]="lines.length === 1" aria-label="Remove line">
                      <app-icon name="x" [size]="16" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="card__body">
          <button type="button" class="btn btn--outline btn--sm" (click)="addLine()"><app-icon name="plus" [size]="16" /> Add line</button>
          @if (errors()['items']; as e) { <small class="field-error" style="margin-left:12px">{{ e }}</small> }
        </div>

        <div class="card__body bottom">
          <div class="notes">
            <div class="field"><label for="notes">Customer notes</label><textarea id="notes" class="textarea" formControlName="notes" placeholder="Thanks for your business."></textarea></div>
            <div class="field mt-2"><label for="terms">Terms & conditions</label><textarea id="terms" class="textarea" formControlName="terms"></textarea></div>
          </div>
          <div class="summary">
            <div class="row"><span>Sub total</span><span class="mono">{{ totals().subtotal | money }}</span></div>
            @for (t of totals().taxBreakup; track t.rate) {
              <div class="row muted"><span>Tax &#64; {{ t.rate }}%</span><span class="mono">{{ t.amount | money }}</span></div>
            }
            <div class="row"><label for="disc">Discount</label><input id="disc" class="input input--sm text-right" type="number" min="0" step="0.01" formControlName="discount" /></div>
            <div class="row"><label for="adj">Adjustment</label><input id="adj" class="input input--sm text-right" type="number" step="0.01" formControlName="adjustment" /></div>
            <div class="row total"><span>Total ({{ auth.currency() }})</span><span class="mono">{{ totals().total | money }}</span></div>
          </div>
        </div>
      </div>

      <div class="actions-bar">
        <a [routerLink]="backLink()" class="btn btn--outline">Cancel</a>
        <span class="spacer"></span>
        @if (recurring()) {
          <button type="submit" class="btn" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ id() ? 'Save profile' : 'Start recurring ' + cfg().label.toLowerCase() }}
          </button>
        } @else {
          <button type="button" class="btn btn--outline" (click)="save('draft')" [disabled]="saving()">Save as draft</button>
          <button type="submit" class="btn" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ id() && currentStatus() !== 'draft' ? 'Save changes' : 'Save & ' + (sendStatus() === 'sent' ? 'send' : 'open') }}
          </button>
        }
      </div>
    </form>
  `,
})
export class DocumentForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthStore);
  protected readonly lookups = inject(LookupsStore);

  readonly docType = input<DocumentType>('invoice');
  readonly id = input<string>();
  /** ?contact=ID preselects a contact (from the contact page). */
  readonly contactParam = input<string>(undefined, { alias: 'contact' });
  /** Route data: edit a recurring profile (schedule + template) instead of a document. */
  readonly recurring = input(false);

  protected readonly cfg = computed(() => DOC_CONFIG[this.docType()]);
  protected readonly sendStatus = computed(() => SEND_STATUS[this.docType()]);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly contact = signal<Contact | null>(null);
  protected readonly nextNumber = signal('Auto');
  protected readonly number = signal('');
  protected readonly currentStatus = signal('draft');
  protected contactText = signal('');
  protected readonly tax = taxProfile(inject(AuthStore).organization());
  protected readonly paymentTerms = PAYMENT_TERMS;
  protected readonly nextRun = signal('');
  /** The user typed a number: stop replacing it with the series preview. */
  protected numberTyped = false;
  protected readonly backLink = computed(() =>
    this.recurring() ? (this.docType() === 'bill' ? '/purchases/recurring-bills' : '/sales/recurring-invoices') : this.cfg().path,
  );

  protected readonly schedule = this.fb.group({
    name: ['', Validators.required],
    frequency: ['month' as RecurringFrequency],
    interval: [1, [Validators.required, Validators.min(1)]],
    start_date: [isoDate(), Validators.required],
    end_date: [''],
    auto_send: [false],
  });

  protected readonly form = this.fb.group({
    contact_id: [null as number | null, Validators.required],
    number: [''],
    reference: [''],
    date: [isoDate(), Validators.required],
    due_date: [''],
    payment_terms: [''],
    discount: [0],
    adjustment: [0],
    notes: [''],
    terms: [''],
    items: this.fb.array([this.newLine()]),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly totals = computed(() => {
    const v = this.value();
    const rates = this.lookups.taxRates();
    return calculateTotals(
      v.items.map((l) => ({ ...l, tax_rate: l.tax_id ? (rates.get(l.tax_id) ?? 0) : 0 })),
      v.discount,
      v.adjustment,
    );
  });

  get lines(): FormArray<ReturnType<DocumentForm['newLine']>> {
    return this.form.controls.items;
  }

  // Typeahead adapters (arrow fns keep `this`).
  protected readonly searchContacts = (q: string) =>
    this.api.list<Contact>('contacts', { type: this.cfg().contactType, q, active: 1, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly contactName = (c: Contact) => c.name;
  protected readonly contactMeta = (c: Contact) => c.company_name ?? '';
  protected readonly searchItems = (q: string) => this.api.list<Item>('items', { q, active: 1, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly itemName = (i: Item) => i.name;
  protected readonly itemMeta = (i: Item) =>
    (i.track_inventory ? `${i.stock_on_hand} ${i.unit} · ` : '') + (this.priceOf(i) ?? 0).toFixed(2);

  ngOnInit(): void {
    const org = this.auth.organization();
    const id = this.id();
    if (id && this.recurring()) {
      this.api.get<RecurringProfile>(`recurring-profiles/${id}`).subscribe((p) => this.patchProfile(p));
    } else if (id) {
      this.api.get<Document>(`documents/${id}`).subscribe((d) => this.patch(d));
    } else {
      this.form.patchValue({ terms: this.cfg().contactType === 'customer' ? (org?.invoice_terms ?? '') : '', notes: this.cfg().contactType === 'customer' ? (org?.invoice_notes ?? '') : '' });
      this.refreshNumber();
      const pre = this.contactParam();
      if (pre) this.api.get<Contact>(`contacts/${pre}`).subscribe((c) => this.pickContact(c));
    }
  }

  newLine(l: Partial<{ item_id: number | null; name: string; description: string | null; quantity: number; unit: string | null; rate: number; discount_percent: number; tax_id: number | null }> = {}) {
    return this.fb.group({
      item_id: [l.item_id ?? (null as number | null)],
      name: [l.name ?? '', Validators.required],
      description: [l.description ?? ''],
      quantity: [l.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
      unit: [l.unit ?? ''],
      rate: [l.rate ?? 0, [Validators.required, Validators.min(0)]],
      discount_percent: [l.discount_percent ?? 0],
      tax_id: [l.tax_id ?? (null as number | null)],
    });
  }

  addLine(): void {
    this.lines.push(this.newLine());
  }

  removeLine(i: number): void {
    if (this.lines.length > 1) this.lines.removeAt(i);
  }

  private priceOf(i: Item): number {
    return this.cfg().priceField === 'purchase_price' ? (i.purchase_price ?? 0) : i.sales_price;
  }

  pickItem(index: number, item: Item): void {
    const line = this.lines.at(index) as FormGroup;
    line.patchValue({ item_id: item.id, name: item.name, description: item.description ?? '', unit: item.unit, rate: this.priceOf(item), tax_id: item.tax_id ?? null });
    if (index === this.lines.length - 1) this.addLine();
  }

  pickContact(c: Contact): void {
    this.contact.set(c);
    this.contactText.set(c.name);
    this.form.controls.contact_id.setValue(c.id);
    if (this.cfg().payable) {
      this.form.controls.payment_terms.setValue(termsForDays(c.payment_terms ?? 30));
    }
    if (this.cfg().payable || !this.form.controls.due_date.value) {
      this.form.controls.due_date.setValue(addDays(this.form.controls.date.value, c.payment_terms ?? 30));
    }
    this.applyTerms();
    this.refreshNumber();
  }

  /** Preview of the next number; with a custom series it depends on the customer ({CODE}) and date. */
  private refreshNumber(): void {
    if (this.id() || this.recurring()) return;
    const v = this.form.getRawValue();
    this.api
      .get<{ number: string }>('documents/next-number', { type: this.docType(), ...(v.contact_id ? { contact_id: v.contact_id } : {}), date: v.date })
      .subscribe((r) => this.nextNumber.set(r.number));
  }

  protected onDateChange(): void {
    this.applyTerms();
    if (!this.numberTyped) this.refreshNumber();
  }

  /** Payment terms → due date (Custom leaves the date as typed). */
  protected applyTerms(): void {
    const due = dueDateFor(this.form.controls.payment_terms.value, this.form.controls.date.value);
    if (due) this.form.controls.due_date.setValue(due);
  }

  private patchProfile(p: RecurringProfile): void {
    this.nextRun.set(p.status === 'active' ? new Date(p.next_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
    this.schedule.patchValue({
      name: p.name,
      frequency: p.frequency,
      interval: p.interval,
      start_date: p.start_date,
      end_date: p.end_date ?? '',
      auto_send: p.auto_send,
    });
    const t = p.template;
    this.lines.clear();
    (t.items ?? []).forEach((l) => this.lines.push(this.newLine({ ...l, discount_percent: l.discount_percent ?? 0 })));
    if (!this.lines.length) this.addLine();
    this.form.patchValue({
      contact_id: p.contact_id,
      reference: t.reference ?? '',
      payment_terms: p.payment_terms ?? '',
      discount: t.discount ?? 0,
      adjustment: t.adjustment ?? 0,
      notes: t.notes ?? '',
      terms: t.terms ?? '',
    });
    if (p.contact) {
      this.contact.set(p.contact);
      this.contactText.set(p.contact.name);
    }
  }

  private patch(d: Document): void {
    this.number.set(d.number);
    this.currentStatus.set(d.status);
    this.lines.clear();
    (d.items ?? []).forEach((l) => this.lines.push(this.newLine({ ...l, discount_percent: l.discount_percent ?? 0 })));
    if (!this.lines.length) this.addLine();
    this.form.patchValue({
      contact_id: d.contact_id,
      number: d.number,
      reference: d.reference ?? '',
      date: d.date,
      due_date: d.due_date ?? '',
      payment_terms: d.payment_terms ?? '',
      discount: d.discount,
      adjustment: d.adjustment,
      notes: d.notes ?? '',
      terms: d.terms ?? '',
    });
    if (d.contact) {
      this.contact.set(d.contact);
      this.contactText.set(d.contact.name);
    }
  }

  save(status: string): void {
    // Ignore the trailing empty line users get after picking an item.
    for (let i = this.lines.length - 1; i > 0; i--) {
      const l = this.lines.at(i).getRawValue();
      if (!l.name && !l.item_id && !l.rate) this.lines.removeAt(i);
    }
    if (this.form.invalid || (this.recurring() && this.schedule.invalid)) {
      this.form.markAllAsTouched();
      this.schedule.markAllAsTouched();
      this.toast.error('Please complete the highlighted fields.');
      return;
    }
    this.saving.set(true);
    this.errors.set({});
    const v = this.form.getRawValue();
    const id = this.id();
    if (this.recurring()) {
      this.saveProfile();
      return;
    }
    const keepStatus = id && status !== 'draft' && this.currentStatus() !== 'draft' ? undefined : status;
    const body = {
      ...v,
      number: v.number || undefined,
      due_date: v.due_date || null,
      payment_terms: v.payment_terms || null,
      ...(keepStatus ? { status: keepStatus } : {}),
      ...(id ? {} : { type: this.docType() }),
    };
    (id ? this.api.put<Document>(`documents/${id}`, body) : this.api.post<Document>('documents', body)).subscribe({
      next: (d) => {
        this.toast.success(`${this.cfg().label} ${d.number} saved`);
        void this.router.navigate([this.cfg().path, d.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }

  private saveProfile(): void {
    const v = this.form.getRawValue();
    const sch = this.schedule.getRawValue();
    const id = this.id();
    const body = {
      ...sch,
      end_date: sch.end_date || null,
      contact_id: v.contact_id,
      payment_terms: v.payment_terms || null,
      reference: v.reference,
      discount: v.discount,
      adjustment: v.adjustment,
      notes: v.notes,
      terms: v.terms,
      items: v.items,
      ...(id ? {} : { type: this.docType() }),
    };
    (id ? this.api.put<RecurringProfile>(`recurring-profiles/${id}`, body) : this.api.post<RecurringProfile>('recurring-profiles', body)).subscribe({
      next: (p) => {
        const made = id ? 0 : p.generated_count;
        this.toast.success(`Recurring ${this.cfg().label.toLowerCase()} "${p.name}" saved` + (made ? ` · ${made} created now` : ''));
        void this.router.navigateByUrl(this.backLink());
      },
      error: (e) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }
}
