import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Contact, Document, DocumentSummary, Payment } from '../../core/api/models';
import { LookupsStore } from '../../core/state/lookups.store';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { Modal } from '../../shared/modal';
import { MoneyPipe } from '../../shared/money.pipe';
import { Typeahead } from '../../shared/typeahead';

/** Record a payment received (in) or made (out), optionally against an invoice/bill. */
@Component({
  selector: 'app-payment-dialog',
  imports: [ReactiveFormsModule, Modal, FieldError, MoneyPipe, Typeahead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="direction() === 'in' ? 'Record payment received' : 'Record payment made'" [width]="560" (closed)="closed.emit()">
      <form [formGroup]="form" id="payment-form" (ngSubmit)="save()" novalidate>
        <div class="form-grid">
          @if (!document()) {
            <div class="field span-all">
              <label class="req" for="pc">{{ direction() === 'in' ? 'Customer' : 'Vendor' }}</label>
              <app-typeahead inputId="pc" [search]="searchContacts" [display]="contactName" placeholder="Search…" (picked)="pickContact($event)" />
              <app-field-error [control]="form.controls.contact_id" label="Contact" />
            </div>
            @if (openDocs().length) {
              <div class="field span-all">
                <label for="pd">Apply to {{ direction() === 'in' ? 'invoice' : 'bill' }}</label>
                <select id="pd" class="select" formControlName="document_id" (change)="applyDoc()">
                  <option [ngValue]="null">Advance / on account</option>
                  @for (d of openDocs(); track d.id) {
                    <option [ngValue]="d.id">{{ d.number }} — due {{ d.balance | money }}</option>
                  }
                </select>
              </div>
            }
          } @else {
            <div class="field span-all">
              <div class="alert alert--info">
                {{ document()!.number }} · Balance due <strong>&nbsp;{{ document()!.balance | money }}</strong>
              </div>
            </div>
          }
          <div class="field">
            <label class="req" for="amt">Amount</label>
            <input id="amt" class="input" type="number" min="0.01" step="0.01" formControlName="amount" />
            <app-field-error [control]="form.controls.amount" label="Amount" [server]="errors()['amount']" />
          </div>
          <div class="field">
            <label class="req" for="pdt">Date</label>
            <input id="pdt" class="input" type="date" formControlName="date" />
          </div>
          <div class="field">
            <label for="mode">Payment mode</label>
            <select id="mode" class="select" formControlName="mode">
              @for (m of lookups.paymentModes(); track m) { <option [value]="m">{{ modeLabel(m) }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="acc">{{ direction() === 'in' ? 'Deposit to' : 'Paid through' }}</label>
            <select id="acc" class="select" formControlName="account_id">
              <option [ngValue]="null">—</option>
              @for (a of lookups.paymentAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
            </select>
          </div>
          <div class="field"><label for="pref">Reference #</label><input id="pref" class="input" formControlName="reference" placeholder="UTR / cheque no." /></div>
          <div class="field span-all"><label for="pn">Notes</label><textarea id="pn" class="textarea" formControlName="notes" rows="2"></textarea></div>
        </div>
        @if (errors()['document_id']; as e) { <div class="alert mt-1">{{ e }}</div> }
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn--outline" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="payment-form" class="btn btn--success" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Record payment' }}</button>
      </ng-container>
    </app-modal>
  `,
})
export class PaymentDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly lookups = inject(LookupsStore);

  readonly direction = input<'in' | 'out'>('in');
  readonly document = input<Document | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Payment>();

  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly openDocs = signal<DocumentSummary[]>([]);
  private readonly contactType = computed(() => (this.direction() === 'in' ? 'customer' : 'vendor'));

  protected readonly form = inject(NonNullableFormBuilder).group({
    contact_id: [null as number | null, Validators.required],
    document_id: [null as number | null],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    date: [isoDate(), Validators.required],
    mode: ['bank_transfer'],
    account_id: [null as number | null],
    reference: [''],
    notes: [''],
  });

  protected readonly searchContacts = (q: string) =>
    this.api.list<Contact>('contacts', { type: this.contactType(), q, per_page: 10 }).pipe(map((r) => r.data));
  protected readonly contactName = (c: Contact) => c.name;
  protected readonly modeLabel = (m: string) => m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  ngOnInit(): void {
    const d = this.document();
    const bank = this.lookups.paymentAccounts().find((a) => a.sub_type === 'bank');
    this.form.patchValue({ account_id: bank?.id ?? null });
    if (d) this.form.patchValue({ contact_id: d.contact_id, document_id: d.id, amount: d.balance });
  }

  pickContact(c: Contact): void {
    this.form.patchValue({ contact_id: c.id, document_id: null });
    const type = this.direction() === 'in' ? 'invoice' : 'bill';
    this.api.list<DocumentSummary>('documents', { type, contact_id: c.id, per_page: 50, sort: 'date' }).subscribe((r) =>
      this.openDocs.set(r.data.filter((d) => d.balance > 0 && !['draft', 'void'].includes(d.status))),
    );
  }

  applyDoc(): void {
    const doc = this.openDocs().find((d) => d.id === this.form.controls.document_id.value);
    if (doc) this.form.controls.amount.setValue(doc.balance);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.post<Payment>('payments', { ...this.form.getRawValue(), direction: this.direction() }).subscribe({
      next: (p) => {
        this.toast.success(`Payment ${p.number} recorded`);
        this.saved.emit(p);
      },
      error: (e) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }
}
