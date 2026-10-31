import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Contact, Document, Item } from '../../core/api/models';
import { BillPreview, BillPreviewLine } from '../../core/ai/ai.models';
import { AiService } from '../../core/ai/ai.service';
import { AuthStore } from '../../core/auth/auth.store';
import { LookupsStore } from '../../core/state/lookups.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { calculateTotals, round2 } from '../../core/utils/totals';
import { Icon } from '../../shared/icon';
import { formatMoney, MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { Typeahead } from '../../shared/typeahead';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const MAX_MB = 10;

type Step = 'upload' | 'reading' | 'review' | 'saving';

/**
 * AI bill scanner: upload a photo / PDF → Gemini reads it → the user reviews and edits
 * every field → only after confirming is the bill (or expense) saved.
 */
@Component({
  selector: 'app-bill-scan',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, Icon, MoneyPipe, Typeahead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bill-scan.scss',
  template: `
    <app-page-header title="Scan bill with AI" subtitle="Upload a bill, receipt or invoice — Gemini reads it, you check it, then confirm to save.">
      @if (step() === 'review') {
        <button type="button" class="btn btn--outline" (click)="reset()"><app-icon name="refresh" /> Scan another</button>
      }
    </app-page-header>

    @if (enabled() === false) {
      <div class="alert alert--warning mb">
        <app-icon name="alert" />
        <span>The AI assistant is not configured yet. Add <code>GEMINI_API_KEY</code> to the backend <code>.env</code> file (see the AI guide).</span>
      </div>
    }

    @if (step() === 'upload' || step() === 'reading') {
      <div class="card">
        <label
          class="drop"
          [class.is-over]="dragOver()"
          [class.is-busy]="step() === 'reading'"
          (dragover)="$event.preventDefault(); dragOver.set(true)"
          (dragleave)="dragOver.set(false)"
          (drop)="onDrop($event)"
        >
          <input type="file" [accept]="accept" (change)="onPick($event)" [disabled]="step() === 'reading'" hidden />
          @if (step() === 'reading') {
            <span class="spinner spinner--lg"></span>
            <strong>Reading {{ file()?.name }}…</strong>
            <span class="muted">Gemini is extracting vendor, items, GST and totals. This takes a few seconds.</span>
          } @else {
            <span class="drop__icon"><app-icon name="upload" [size]="30" /></span>
            <strong>Drop a bill here or click to choose</strong>
            <span class="muted">Photo (JPG, PNG, WEBP, HEIC) or PDF · up to {{ maxMb }} MB</span>
          }
        </label>
        <div class="card__body tips">
          <div><app-icon name="check" [size]="16" /> Nothing is saved until you press <strong>Confirm &amp; save</strong>.</div>
          <div><app-icon name="check" [size]="16" /> Existing vendors and items are matched automatically; new ones can be created.</div>
          <div><app-icon name="check" [size]="16" /> On a phone, choosing a file lets you take a photo with the camera.</div>
        </div>
      </div>
    }

    @if (preview() && (step() === 'review' || step() === 'saving')) {
      <div class="layout">
        <aside class="card source">
          <div class="card__header"><h3>Uploaded document</h3></div>
          @if (fileUrl(); as url) {
            @if (isPdf()) {
              <iframe [src]="url" title="Uploaded bill"></iframe>
            } @else {
              <a [href]="rawUrl()" target="_blank" rel="noopener"><img [src]="rawUrl()" alt="Uploaded bill" /></a>
            }
          }
          <div class="card__body small muted">
            {{ file()?.name }}
            @if (preview()!.confidence !== null) { · AI confidence {{ (preview()!.confidence! * 100).toFixed(0) }}% }
          </div>
        </aside>

        <form class="review" [formGroup]="form" (ngSubmit)="confirm()" novalidate>
          @for (w of preview()!.warnings; track w) {
            <div class="alert alert--warning"><app-icon name="alert" /><span>{{ w }}</span></div>
          }
          <div class="alert alert--info"><app-icon name="eye" /><span>Check the data below. Edit anything that is wrong, then confirm.</span></div>

          <div class="card">
            <div class="card__body">
              <div class="row-between">
                <h3>Save as</h3>
                <div class="segmented">
                  <button type="button" [class.is-active]="target() === 'bill'" (click)="form.controls.target.setValue('bill')">Purchase bill</button>
                  <button type="button" [class.is-active]="target() === 'expense'" (click)="form.controls.target.setValue('expense')">Expense</button>
                </div>
              </div>
              <p class="muted small mt-1">
                {{ target() === 'bill' ? 'Bills track items, stock and what you owe the vendor.' : 'Expenses record a one-off spend (rent, fuel, electricity…) in a category.' }}
              </p>
            </div>
          </div>

          <!-- Vendor -->
          <div class="card" formGroupName="vendor">
            <div class="card__header">
              <h3>Vendor</h3>
              @if (vendorId()) {
                <span class="badge" data-tone="success">Existing vendor</span>
              } @else if (form.controls.vendor.controls.name.value) {
                <span class="badge" data-tone="info">New vendor will be created</span>
              }
            </div>
            <div class="card__body">
              <div class="field">
                <label for="vendor-pick">Match with an existing vendor</label>
                <app-typeahead inputId="vendor-pick" [search]="searchVendors" [display]="contactName" [meta]="contactMeta" [(text)]="vendorText" placeholder="Search vendors…" (picked)="pickVendor($event)" />
                @if (vendorId()) {
                  <small class="muted">Linked to <strong>{{ vendorText() }}</strong> · <button type="button" class="link" (click)="unlinkVendor()">create a new vendor instead</button></small>
                }
              </div>
              @if (!vendorId()) {
                <div class="form-grid mt-2">
                  <div class="field span-2">
                    <label for="v-name" [class.req]="target() === 'bill'">Vendor name</label>
                    <input id="v-name" class="input" formControlName="name" />
                    @if (errors()['vendor.name']; as e) { <small class="field-error">{{ e }}</small> }
                  </div>
                  <div class="field"><label for="v-gstin">GSTIN</label><input id="v-gstin" class="input" formControlName="gstin" /></div>
                  <div class="field"><label for="v-phone">Phone</label><input id="v-phone" class="input" formControlName="phone" /></div>
                  <div class="field"><label for="v-email">Email</label><input id="v-email" class="input" formControlName="email" /></div>
                  <div class="field"><label for="v-city">City</label><input id="v-city" class="input" formControlName="city" /></div>
                  <div class="field"><label for="v-state">State</label><input id="v-state" class="input" formControlName="state" /></div>
                  <div class="field"><label for="v-pin">Pincode</label><input id="v-pin" class="input" formControlName="pincode" /></div>
                  <div class="field span-all"><label for="v-addr">Address</label><input id="v-addr" class="input" formControlName="billing_address" /></div>
                </div>
              }
            </div>
          </div>

          <!-- Bill details -->
          <div class="card">
            <div class="card__header"><h3>{{ target() === 'bill' ? 'Bill details' : 'Expense details' }}</h3></div>
            <div class="card__body">
              <div class="form-grid">
                <div class="field"><label for="ref">Vendor bill #</label><input id="ref" class="input" formControlName="reference" /></div>
                <div class="field"><label class="req" for="date">Date</label><input id="date" type="date" class="input" formControlName="date" /></div>
                @if (target() === 'bill') {
                  <div class="field">
                    <label for="due">Due date</label><input id="due" type="date" class="input" formControlName="due_date" />
                    @if (errors()['due_date']; as e) { <small class="field-error">{{ e }}</small> }
                  </div>
                  <div class="field">
                    <label for="status">Save as</label>
                    <select id="status" class="select" formControlName="status">
                      <option value="open">Open (adds stock, counts as payable)</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                }
              </div>
            </div>
          </div>

          @if (target() === 'bill') {
            <div class="card">
              <div class="card__header"><h3>Items ({{ lines.length }})</h3></div>
              <div class="table-wrap lines">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="min-width:230px">Item</th>
                      <th style="width:90px" class="text-right">Qty</th>
                      <th style="width:120px" class="text-right">Rate</th>
                      <th style="width:80px" class="text-right">Disc %</th>
                      <th style="width:130px">Tax</th>
                      <th style="width:120px" class="text-right">Amount</th>
                      <th style="width:40px"></th>
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
                            [text]="line.controls.name.value"
                            (textChange)="line.controls.name.setValue($event)"
                            (picked)="pickItem(i, $event)"
                          />
                          <div class="line-meta">
                            @if (line.controls.item_id.value) {
                              <span class="badge" data-tone="success">Matched item</span>
                              <button type="button" class="link" (click)="unlinkItem(i)">unlink</button>
                            } @else {
                              <label class="checkbox small"><input type="checkbox" formControlName="create_item" /> Create as new item</label>
                            }
                            @if (line.controls.hsn_code.value) { <small class="muted">HSN {{ line.controls.hsn_code.value }}</small> }
                          </div>
                          @if (errors()['items.' + i + '.name']; as e) { <small class="field-error">{{ e }}</small> }
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
                          <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="removeLine(i)" [disabled]="lines.length === 1" aria-label="Remove line"><app-icon name="x" [size]="16" /></button>
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
                <div class="field"><label for="notes">Notes</label><textarea id="notes" class="textarea" formControlName="notes"></textarea></div>
                <div class="summary">
                  <div class="row"><span>Sub total</span><span class="mono">{{ totals().subtotal | money }}</span></div>
                  @for (t of totals().taxBreakup; track t.rate) {
                    <div class="row muted"><span>GST &#64; {{ t.rate }}%</span><span class="mono">{{ t.amount | money }}</span></div>
                  }
                  <div class="row"><label for="disc">Discount</label><input id="disc" class="input input--sm text-right" type="number" min="0" step="0.01" formControlName="discount" /></div>
                  <div class="row"><label for="adj">Adjustment / round off</label><input id="adj" class="input input--sm text-right" type="number" step="0.01" formControlName="adjustment" /></div>
                  <div class="row total"><span>Total</span><span class="mono">{{ totals().total | money }}</span></div>
                  @if (billTotal() !== null) {
                    <div class="row" [class.text-danger]="mismatch() !== 0" [class.text-success]="mismatch() === 0">
                      <span>Total printed on bill</span><span class="mono">{{ billTotal() | money }}</span>
                    </div>
                    @if (mismatch() !== 0) {
                      <button type="button" class="btn btn--outline btn--sm" (click)="matchTotal()">Difference {{ mismatch() | money }} — adjust to match bill</button>
                    }
                  }
                </div>
              </div>
            </div>
          } @else {
            <div class="card" formGroupName="expense">
              <div class="card__body">
                <div class="form-grid">
                  <div class="field">
                    <label class="req" for="e-acc">Category</label>
                    <select id="e-acc" class="select" formControlName="account_id">
                      <option [ngValue]="null">Choose…</option>
                      @for (a of lookups.expenseAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                    </select>
                    @if (errors()['expense.account_id']; as e) { <small class="field-error">{{ e }}</small> }
                  </div>
                  <div class="field">
                    <label for="e-paid">Paid through</label>
                    <select id="e-paid" class="select" formControlName="paid_through_id">
                      <option [ngValue]="null">Not paid yet / skip</option>
                      @for (a of lookups.paymentAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                    </select>
                  </div>
                  <div class="field">
                    <label class="req" for="e-amt">Amount (before tax)</label>
                    <input id="e-amt" class="input text-right" type="number" min="0" step="0.01" formControlName="amount" />
                    @if (errors()['expense.amount']; as e) { <small class="field-error">{{ e }}</small> }
                  </div>
                  <div class="field">
                    <label for="e-tax">Tax</label>
                    <select id="e-tax" class="select" formControlName="tax_id">
                      <option [ngValue]="null">No tax</option>
                      @for (t of lookups.taxes(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
                    </select>
                  </div>
                  <div class="field span-all"><label for="e-desc">Description</label><input id="e-desc" class="input" formControlName="description" /></div>
                </div>
                <div class="summary mt-2">
                  <div class="row total"><span>Total with tax</span><span class="mono">{{ expenseTotal() | money }}</span></div>
                  @if (billTotal() !== null) {
                    <div class="row muted"><span>Total printed on bill</span><span class="mono">{{ billTotal() | money }}</span></div>
                  }
                </div>
              </div>
            </div>
          }

          <div class="actions-bar">
            <a routerLink="/purchases/bills" class="btn btn--outline">Cancel</a>
            <span class="spacer"></span>
            <button type="submit" class="btn" [disabled]="step() === 'saving'">
              @if (step() === 'saving') { <span class="spinner"></span> } @else { <app-icon name="check" /> }
              Confirm &amp; save
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class BillScan {
  private readonly ai = inject(AiService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthStore);
  protected readonly lookups = inject(LookupsStore);

  protected readonly accept = ACCEPT;
  protected readonly maxMb = MAX_MB;
  protected readonly step = signal<Step>('upload');
  protected readonly dragOver = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly rawUrl = signal<string>('');
  protected readonly fileUrl = signal<SafeResourceUrl | null>(null);
  protected readonly preview = signal<BillPreview | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly enabled = toSignal(this.ai.status().pipe(map((s) => s.enabled)), { initialValue: null });
  protected readonly isPdf = computed(() => this.file()?.type === 'application/pdf');
  protected readonly vendorText = signal('');

  protected readonly form = this.fb.group({
    target: ['bill' as 'bill' | 'expense'],
    reference: [''],
    date: ['', Validators.required],
    due_date: [''],
    status: ['open' as 'open' | 'draft'],
    discount: [0],
    adjustment: [0],
    notes: [''],
    vendor: this.fb.group({
      id: [null as number | null],
      name: [''],
      gstin: [''],
      pan: [''],
      phone: [''],
      email: [''],
      billing_address: [''],
      city: [''],
      state: [''],
      pincode: [''],
    }),
    items: this.fb.array([this.newLine()]),
    expense: this.fb.group({
      account_id: [null as number | null],
      paid_through_id: [null as number | null],
      amount: [0],
      tax_id: [null as number | null],
      description: [''],
    }),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  protected readonly target = computed(() => this.value().target);
  protected readonly vendorId = computed(() => this.value().vendor.id);
  protected readonly totals = computed(() => {
    const v = this.value();
    const rates = this.lookups.taxRates();
    return calculateTotals(v.items.map((l) => ({ ...l, tax_rate: l.tax_id ? (rates.get(l.tax_id) ?? 0) : 0 })), v.discount, v.adjustment);
  });
  protected readonly expenseTotal = computed(() => {
    const e = this.value().expense;
    const amount = Number(e.amount) || 0;
    return round2(amount + (amount * this.lookups.taxRate(e.tax_id)) / 100);
  });
  protected readonly billTotal = computed(() => this.preview()?.extracted.total ?? null);
  protected readonly mismatch = computed(() => {
    const b = this.billTotal();
    return b === null ? 0 : round2(b - this.totals().total);
  });

  get lines(): FormArray<ReturnType<BillScan['newLine']>> {
    return this.form.controls.items;
  }

  protected readonly searchVendors = (q: string) => this.api.list<Contact>('contacts', { type: 'vendor', q, active: 1, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly contactName = (c: Contact) => c.name;
  protected readonly contactMeta = (c: Contact) => c.gstin ?? c.city ?? '';
  protected readonly searchItems = (q: string) => this.api.list<Item>('items', { q, active: 1, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly itemName = (i: Item) => i.name;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokeUrl());
    // A file handed over from the chat assistant's 📎 button (also while this page is open).
    effect(() => {
      const pending = this.ai.pendingFile();
      if (pending) {
        untracked(() => {
          this.ai.pendingFile.set(null);
          this.start(pending);
        });
      }
    });
  }

  newLine(l: Partial<BillPreviewLine> = {}) {
    return this.fb.group({
      item_id: [l.item_id ?? (null as number | null)],
      name: [l.name ?? '', Validators.required],
      description: [l.description ?? ''],
      hsn_code: [l.hsn_code ?? ''],
      quantity: [l.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
      unit: [l.unit ?? 'pcs'],
      rate: [l.rate ?? 0, [Validators.required, Validators.min(0)]],
      discount_percent: [l.discount_percent ?? 0],
      tax_id: [l.tax_id ?? (null as number | null)],
      create_item: [l.create_item ?? false],
    });
  }

  addLine(): void {
    this.lines.push(this.newLine());
  }

  removeLine(i: number): void {
    if (this.lines.length > 1) this.lines.removeAt(i);
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) this.start(f);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.start(f);
  }

  private start(f: File): void {
    if (!ACCEPT.split(',').includes(f.type)) {
      this.toast.error('Upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      this.toast.error(`The file is larger than ${MAX_MB} MB.`);
      return;
    }
    this.revokeUrl();
    const url = URL.createObjectURL(f);
    this.file.set(f);
    this.rawUrl.set(url);
    // Blob URL created from the user's own file in this tab.
    this.fileUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.step.set('reading');
    this.ai.scanBill(f).subscribe({
      next: (p) => {
        this.load(p);
        this.step.set('review');
      },
      error: (err) => {
        this.step.set('upload');
        this.toast.error(errorMessage(err, 'The bill could not be read. Try a clearer photo.'));
      },
    });
  }

  private load(p: BillPreview): void {
    this.preview.set(p);
    this.errors.set({});
    this.lines.clear();
    p.items.forEach((l) => this.lines.push(this.newLine({ ...l, create_item: !l.item_id })));
    if (!this.lines.length) this.addLine();
    this.vendorText.set(p.vendor.matched_name ?? '');
    this.form.patchValue({
      target: p.target,
      reference: p.reference ?? '',
      date: p.date,
      due_date: p.due_date ?? '',
      status: 'open',
      discount: p.discount ?? 0,
      adjustment: 0,
      notes: p.notes ?? '',
      vendor: {
        id: p.vendor.id,
        name: p.vendor.name ?? '',
        gstin: p.vendor.gstin ?? '',
        pan: p.vendor.pan ?? '',
        phone: p.vendor.phone ?? '',
        email: p.vendor.email ?? '',
        billing_address: p.vendor.billing_address ?? '',
        city: p.vendor.city ?? '',
        state: p.vendor.state ?? '',
        pincode: p.vendor.pincode ?? '',
      },
      expense: { account_id: p.expense.account_id, paid_through_id: null, amount: p.expense.amount, tax_id: p.expense.tax_id, description: p.expense.description ?? '' },
    });
    // Small rounding differences (round-off lines on bills) are folded into the adjustment.
    const diff = this.mismatch();
    if (diff !== 0 && Math.abs(diff) < 1) this.form.controls.adjustment.setValue(diff);
  }

  pickVendor(c: Contact): void {
    this.form.controls.vendor.controls.id.setValue(c.id);
  }

  unlinkVendor(): void {
    this.form.controls.vendor.controls.id.setValue(null);
    this.vendorText.set('');
  }

  pickItem(i: number, item: Item): void {
    this.lines.at(i).patchValue({ item_id: item.id, name: item.name, unit: item.unit ?? 'pcs', tax_id: item.tax_id ?? this.lines.at(i).controls.tax_id.value, create_item: false });
  }

  unlinkItem(i: number): void {
    this.lines.at(i).patchValue({ item_id: null, create_item: true });
  }

  matchTotal(): void {
    const adj = Number(this.form.controls.adjustment.value) || 0;
    this.form.controls.adjustment.setValue(round2(adj + this.mismatch()));
  }

  reset(): void {
    this.revokeUrl();
    this.preview.set(null);
    this.file.set(null);
    this.step.set('upload');
  }

  async confirm(): Promise<void> {
    const v = this.form.getRawValue();
    const isBill = v.target === 'bill';
    if (isBill && this.lines.invalid) {
      this.lines.markAllAsTouched();
      this.toast.error('Every line needs a name, quantity and rate.');
      return;
    }
    const vendorName = v.vendor.id ? this.vendorText() : v.vendor.name;
    const newItems = isBill ? v.items.filter((l) => !l.item_id && l.create_item).length : 0;
    const total = isBill ? this.totals().total : this.expenseTotal();
    const cur = this.auth.currency();
    const details = [
      isBill ? `Bill from ${vendorName || '—'}` : `Expense${vendorName ? ' · ' + vendorName : ''}`,
      `dated ${v.date}`,
      `total ${formatMoney(total, cur)}`,
      isBill ? `${v.items.length} line(s)` : '',
      !v.vendor.id && vendorName ? 'a new vendor will be created' : '',
      newItems ? `${newItems} new item(s) will be created` : '',
    ].filter(Boolean);
    const ok = await this.confirmSvc.ask('Save this ' + (isBill ? 'bill' : 'expense') + '?', details.join(' · ') + '.', { confirmText: 'Yes, save' });
    if (!ok) return;

    this.step.set('saving');
    this.errors.set({});
    const vendor: Record<string, unknown> | null = v.vendor.id
      ? { id: v.vendor.id }
      : v.vendor.name
        ? Object.fromEntries(Object.entries(v.vendor).map(([k, x]) => [k, x === '' ? null : x]))
        : null;
    const payload = {
      target: v.target,
      reference: v.reference || null,
      date: v.date,
      due_date: isBill ? v.due_date || null : null,
      status: v.status,
      discount: v.discount,
      adjustment: v.adjustment,
      notes: v.notes || null,
      vendor,
      ...(isBill ? { items: v.items.map((l) => ({ ...l, create_item: !l.item_id && l.create_item })) } : { expense: v.expense }),
    };
    this.ai.importBill(payload).subscribe({
      next: (r) => {
        this.toast.success(r.type === 'bill' ? `Bill ${(r.record as Document).number} saved` : 'Expense saved');
        void this.router.navigateByUrl(r.type === 'bill' ? `/purchases/bills/${r.record.id}` : '/expenses');
      },
      error: (e) => {
        this.step.set('review');
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }

  private revokeUrl(): void {
    const url = this.rawUrl();
    if (url) URL.revokeObjectURL(url);
    this.rawUrl.set('');
    this.fileUrl.set(null);
  }
}
