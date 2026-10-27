import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { AuthHero } from './auth-hero';
import { PHONE_PATTERN } from './login';

export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('password_confirmation');
  if (confirm && pass !== confirm.value) {
    confirm.setErrors({ ...(confirm.errors ?? {}), mismatch: true });
    return { mismatch: true };
  }
  if (confirm?.hasError('mismatch')) {
    const { mismatch: _m, ...rest } = confirm.errors ?? {};
    confirm.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, AuthHero],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.scss',
  template: `
    <app-auth-hero />
    <section class="panel">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div>
          <h1>Create your account</h1>
          <p class="muted">Set up your organization in under a minute.</p>
        </div>
        @if (auth.error(); as error) {
          <div class="alert" role="alert"><app-icon name="alert" /> {{ error }}</div>
        }
        <div class="field">
          <label for="org">Business name</label>
          <input id="org" class="input" formControlName="organization_name" placeholder="Acme Traders" />
          <app-field-error [control]="form.controls.organization_name" label="Business name" />
        </div>
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" class="input" formControlName="name" autocomplete="name" />
          <app-field-error [control]="form.controls.name" label="Name" />
        </div>
        <div class="field">
          <label for="phone">Mobile number</label>
          <input id="phone" class="input" type="tel" formControlName="phone" autocomplete="tel" placeholder="98765 43210" />
          <app-field-error [control]="form.controls.phone" label="Mobile number" />
        </div>
        <div class="field">
          <label for="email">Email <span class="muted">(optional)</span></label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
          <app-field-error [control]="form.controls.email" label="Email" />
        </div>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr">
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password" label="Password" />
          </div>
          <div class="field">
            <label for="confirm">Confirm</label>
            <input id="confirm" class="input" type="password" formControlName="password_confirmation" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password_confirmation" label="Confirmation" />
          </div>
        </div>
        <small class="muted">At least 8 characters with letters and numbers.</small>
        <button type="submit" class="btn btn--block btn--lg" [disabled]="auth.loading()">
          @if (auth.loading()) {
            <span class="spinner"></span>
          }
          Create account
        </button>
        <p class="switch">Already have an account? <a routerLink="/login">Sign in</a></p>
      </form>
    </section>
  `,
})
export class Register {
  protected readonly auth = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group(
    {
      organization_name: ['', Validators.required],
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
      email: ['', Validators.email],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    this.auth.clearError();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.auth.register(this.form.getRawValue());
  }
}
