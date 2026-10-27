import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Contact, ContactType } from '../../core/api/models';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="(id() ? 'Edit ' : 'New ') + singular()" />
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="card__body">
        <div class="form-section">
          <h3>Basic information</h3>
          <div class="form-grid">
            <div class="field">
              <label class="req" for="name">Display name</label>
              <input id="name" class="input" formControlName="name" />
              <app-field-error [control]="form.controls.name" label="Name" [server]="errors()['name']" />
            </div>
            <div class="field"><label for="company">Company name</label><input id="company" class="input" formControlName="company_name" /></div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" class="input" type="email" formControlName="email" />
              <app-field-error [control]="form.controls.email" [server]="errors()['email']" />
            </div>
            <div class="field"><label for="phone">Phone</label><input id="phone" class="input" type="tel" formControlName="phone" /></div>
            <div class="field"><label for="gstin">GSTIN</label><input id="gstin" class="input" formControlName="gstin" placeholder="22AAAAA0000A1Z5" /></div>
            <div class="field"><label for="pan">PAN</label><input id="pan" class="input" formControlName="pan" /></div>
            <div class="field">
              <label for="terms">Payment terms (days)</label>
              <input id="terms" class="input" type="number" min="0" formControlName="payment_terms" />
            </div>
            <div class="field">
              <label for="ob">Opening balance</label>
              <input id="ob" class="input" type="number" step="0.01" formControlName="opening_balance" />
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>Address</h3>
          <div class="form-grid">
            <div class="field span-2"><label for="ba">Billing address</label><textarea id="ba" class="textarea" formControlName="billing_address"></textarea></div>
            <div class="field span-2"><label for="sa">Shipping address</label><textarea id="sa" class="textarea" formControlName="shipping_address"></textarea></div>
            <div class="field"><label for="city">City</label><input id="city" class="input" formControlName="city" /></div>
            <div class="field"><label for="state">State</label><input id="state" class="input" formControlName="state" /></div>
            <div class="field"><label for="country">Country</label><input id="country" class="input" formControlName="country" /></div>
            <div class="field"><label for="pin">PIN code</label><input id="pin" class="input" formControlName="pincode" /></div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-grid">
            <div class="field span-all"><label for="notes">Notes</label><textarea id="notes" class="textarea" formControlName="notes"></textarea></div>
            <label class="checkbox"><input type="checkbox" formControlName="is_active" /> Active</label>
          </div>
        </div>
      </div>
      <div class="card__footer form-actions">
        <a [routerLink]="back()" class="btn btn--outline">Cancel</a>
        <button type="submit" class="btn" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
      </div>
    </form>
  `,
})
export class ContactForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  readonly contactType = input<ContactType>('customer');
  protected readonly singular = computed(() => (this.contactType() === 'customer' ? 'Customer' : 'Vendor'));
  protected readonly back = computed(() => '/' + (this.contactType() === 'customer' ? 'customers' : 'vendors'));
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    company_name: [''],
    email: ['', Validators.email],
    phone: [''],
    gstin: [''],
    pan: [''],
    payment_terms: [30],
    opening_balance: [0],
    billing_address: [''],
    shipping_address: [''],
    city: [''],
    state: [''],
    country: ['India'],
    pincode: [''],
    notes: [''],
    is_active: [true],
  });

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.api.get<Contact>(`contacts/${id}`).subscribe((c) => this.form.patchValue(c as never));
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const body = { ...this.form.getRawValue(), type: this.contactType() };
    const id = this.id();
    const req = id ? this.api.put<Contact>(`contacts/${id}`, body) : this.api.post<Contact>('contacts', body);
    req.subscribe({
      next: (c) => {
        this.toast.success(`${this.singular()} saved`);
        void this.router.navigate([this.back(), c.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }
}
